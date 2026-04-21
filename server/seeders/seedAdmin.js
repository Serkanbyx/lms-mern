/**
 * Idempotent platform seeder.
 *
 * Run with:
 *   `npm run seed:admin`           → admin user only (default)
 *   `npm run seed:admin -- --demo` → admin + demo dataset (instructors,
 *                                     students, courses, sections,
 *                                     lessons, quizzes, enrollments)
 *
 * Behavior:
 *  - Connects to Mongo via the shared `connectDB` helper.
 *  - Always ensures the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
 *    exists (creates it if missing, force-promotes & re-activates an
 *    existing one, never rewrites the password).
 *  - When `--demo` (alias `--with-demo`) is passed, also seeds a
 *    deterministic demo catalog: 3 instructors, 5 students, 5 courses
 *    spanning every category, sections + video/text lessons + quizzes,
 *    and a handful of enrollments with partial progress.
 *  - All seed steps are idempotent — safe to run repeatedly in CI/CD as
 *    an "ensure baseline state" guard. Existing rows are detected by
 *    deterministic keys (email, course title) and never duplicated.
 *  - Demo data flows through the model layer (not raw inserts) so all
 *    pre/post hooks fire: passwords hash, course slugs generate,
 *    `totalLessons` / `totalDuration` / `enrollmentCount` /
 *    `progressPercent` / `Lesson.hasQuiz` stay consistent.
 */

import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { Section } from '../models/Section.model.js';
import { User } from '../models/User.model.js';

const log = (...args) => {
  // eslint-disable-next-line no-console
  console.log('[seed]', ...args);
};
const err = (...args) => {
  // eslint-disable-next-line no-console
  console.error('[seed]', ...args);
};

const args = new Set(process.argv.slice(2));
const SEED_DEMO = args.has('--demo') || args.has('--with-demo');

const exitWith = async (code, message) => {
  if (message) (code === 0 ? log : err)(message);
  await mongoose.connection.close().catch(() => {});
  process.exit(code);
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const seedAdmin = async () => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in your .env to seed an admin.',
    );
  }

  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email });

  if (existing) {
    let dirty = false;
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      dirty = true;
    }
    if (!existing.isActive) {
      existing.isActive = true;
      dirty = true;
    }
    if (dirty) {
      await existing.save();
      log(`Promoted existing user "${email}" to admin.`);
    } else {
      log(`Admin user "${email}" already exists — nothing to do.`);
    }
    return existing;
  }

  const created = await User.create({
    name: env.ADMIN_NAME,
    email,
    password: env.ADMIN_PASSWORD,
    role: 'admin',
    isActive: true,
  });
  log(`Created admin user "${email}".`);
  return created;
};

// ---------------------------------------------------------------------------
// Demo dataset
// ---------------------------------------------------------------------------

// Shared password for every demo account. Long enough to satisfy the
// `User.password` minlength (8 chars) and trivial to remember when
// logging in manually for QA.
const DEMO_PASSWORD = 'DemoPass1234!';

// HTTPS-hosted public sample videos — required by the `Lesson.videoUrl`
// validator (it rejects anything that isn't `https://…`).
const SAMPLE_VIDEO_BIG_BUCK_BUNNY =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SAMPLE_VIDEO_ELEPHANTS_DREAM =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';

/**
 * Find-or-create a user by email. Returns the persisted document so the
 * caller can reference its `_id` in subsequent inserts.
 */
const upsertUser = async ({ email, password = DEMO_PASSWORD, ...rest }) => {
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    log(`User "${normalized}" already exists — skipping.`);
    return existing;
  }
  const created = await User.create({
    ...rest,
    email: normalized,
    password,
    isActive: true,
  });
  log(`Created ${created.role} "${normalized}".`);
  return created;
};

/**
 * Create a course (with sections, lessons, optional quizzes) only if a
 * course with the same `title` doesn't already exist. The `Course`
 * pre-save hook generates the slug; the `Lesson` post-save hook keeps
 * `Course.totalLessons` / `Course.totalDuration` in sync; the `Quiz`
 * post-save hook flips `Lesson.hasQuiz` automatically.
 */
const seedCourse = async ({ instructor, course, sections }) => {
  const existing = await Course.findOne({ title: course.title });
  if (existing) {
    log(`Course "${course.title}" already exists — skipping curriculum.`);
    return existing;
  }

  const created = await Course.create({
    ...course,
    instructor: instructor._id,
  });
  log(`Created course "${created.title}" (/${created.slug}).`);

  for (const sectionData of sections) {
    const section = await Section.create({
      courseId: created._id,
      title: sectionData.title,
      order: sectionData.order,
    });

    for (const lessonData of sectionData.lessons) {
      const { quiz, ...lessonFields } = lessonData;
      const lesson = await Lesson.create({
        courseId: created._id,
        sectionId: section._id,
        ...lessonFields,
      });

      if (quiz) {
        await Quiz.create({
          lessonId: lesson._id,
          courseId: created._id,
          ...quiz,
        });
      }
    }
  }

  return created;
};

/**
 * Enroll a student in a course (idempotent), optionally pre-marking
 * lessons as completed by their title. The `Enrollment` pre-save hook
 * recomputes `progressPercent` and stamps `completedAt` automatically.
 */
const enrollStudent = async (student, course, completedLessonTitles = []) => {
  const existing = await Enrollment.findOne({
    userId: student._id,
    courseId: course._id,
  });
  if (existing) {
    log(`Enrollment "${student.email}" → "${course.title}" already exists.`);
    return existing;
  }

  let completedLessons = [];
  let lastAccessedLesson = null;

  if (completedLessonTitles.length > 0) {
    const lessons = await Lesson.find(
      { courseId: course._id, title: { $in: completedLessonTitles } },
      '_id title',
    );
    completedLessons = lessons.map((l) => l._id);
    lastAccessedLesson = completedLessons.at(-1) ?? null;
  }

  const enrollment = await new Enrollment({
    userId: student._id,
    courseId: course._id,
    completedLessons,
    lastAccessedLesson,
  }).save();

  log(
    `Enrolled "${student.email}" → "${course.title}" ` +
      `(${enrollment.progressPercent}% complete).`,
  );
  return enrollment;
};

const seedDemo = async () => {
  log('Seeding demo dataset…');

  // --- Instructors -------------------------------------------------------
  const ada = await upsertUser({
    name: 'Ada Lawson',
    email: 'ada.instructor@demo.local',
    role: 'instructor',
    headline: 'Senior Frontend Engineer · JavaScript & React mentor',
    bio: 'Ten years building production web apps. Loves teaching the boring fundamentals that make the fancy stuff click.',
  });

  const ben = await upsertUser({
    name: 'Ben Carter',
    email: 'ben.instructor@demo.local',
    role: 'instructor',
    headline: 'Data scientist & Python instructor',
    bio: 'PhD in applied statistics. Writes Pandas like other people write English.',
  });

  const clara = await upsertUser({
    name: 'Clara Bennett',
    email: 'clara.instructor@demo.local',
    role: 'instructor',
    headline: 'Product Designer · UX/UI educator',
    bio: 'From research to high-fidelity prototypes — design that ships.',
  });

  // --- Students ----------------------------------------------------------
  const studentSeeds = [
    {
      name: 'Daniel Reed',
      email: 'daniel.student@demo.local',
      headline: 'CS undergrad chasing a frontend role',
      interests: ['programming', 'design'],
    },
    {
      name: 'Emma Foster',
      email: 'emma.student@demo.local',
      headline: 'Analyst pivoting into data science',
      interests: ['data-science', 'business'],
    },
    {
      name: 'Felix Hayes',
      email: 'felix.student@demo.local',
      headline: 'Self-taught dev, full-time tinkerer',
      interests: ['programming'],
    },
    {
      name: 'Grace Morgan',
      email: 'grace.student@demo.local',
      headline: 'Marketer learning UX',
      interests: ['design', 'marketing'],
    },
    {
      name: 'Henry Walsh',
      email: 'henry.student@demo.local',
      headline: 'Lifelong learner',
      interests: ['language', 'other'],
    },
  ];

  const students = [];
  for (const { interests, ...rest } of studentSeeds) {
    const student = await upsertUser({
      ...rest,
      role: 'student',
      preferences: {
        interests,
        onboardingCompletedAt: new Date(),
      },
    });
    students.push(student);
  }

  // --- Courses -----------------------------------------------------------
  const jsCourse = await seedCourse({
    instructor: ada,
    course: {
      title: 'JavaScript Fundamentals',
      shortDescription:
        'Variables, functions, async — the everyday JavaScript every web developer needs.',
      description:
        'A no-fluff tour of modern JavaScript. We cover the language essentials with small, runnable examples and end every section with a hands-on exercise so the syntax actually sticks.',
      price: 0,
      category: 'programming',
      level: 'beginner',
      tags: ['javascript', 'es6', 'web', 'fundamentals'],
      requirements: ['Basic computer literacy', 'A modern browser'],
      learningOutcomes: [
        'Read and write modern ES6+ syntax confidently',
        'Use functions, scope, and closures correctly',
        'Handle async work with Promises and async/await',
      ],
      status: 'published',
    },
    sections: [
      {
        title: 'Getting Started',
        order: 0,
        lessons: [
          {
            title: 'Welcome to JavaScript',
            type: 'text',
            order: 0,
            duration: 180,
            isFreePreview: true,
            content:
              'Welcome! In this course we will build a working mental model of JavaScript from the ground up — values, variables, control flow, functions, and the event loop.',
          },
          {
            title: 'Setting Up Your Environment',
            type: 'video',
            order: 1,
            duration: 420,
            videoUrl: SAMPLE_VIDEO_BIG_BUCK_BUNNY,
            videoProvider: 'cloudinary',
          },
        ],
      },
      {
        title: 'Language Essentials',
        order: 1,
        lessons: [
          {
            title: 'Variables and Types',
            type: 'text',
            order: 0,
            duration: 360,
            content:
              'JavaScript has eight types: seven primitives (string, number, bigint, boolean, null, undefined, symbol) plus object. Prefer `const`; reach for `let` only when you actually reassign.',
          },
          {
            title: 'Control Flow',
            type: 'text',
            order: 1,
            duration: 300,
            content:
              'Conditionals, loops, and short-circuit operators. Modern JavaScript leans heavily on expressions (ternaries, ??, ?.) over multi-line `if` statements.',
          },
          {
            title: 'Functions and Scope',
            type: 'video',
            order: 2,
            duration: 540,
            videoUrl: SAMPLE_VIDEO_ELEPHANTS_DREAM,
            videoProvider: 'cloudinary',
            quiz: {
              title: 'Functions & Scope check',
              description:
                'Three quick questions to confirm the fundamentals stuck.',
              passingScore: 70,
              timeLimitSeconds: 300,
              questions: [
                {
                  question: 'Which keyword creates a block-scoped binding that cannot be reassigned?',
                  options: ['var', 'let', 'const', 'function'],
                  correctIndex: 2,
                  explanation: '`const` is block-scoped and disallows reassignment of the binding.',
                },
                {
                  question: 'What does an arrow function NOT have its own binding for?',
                  options: ['parameters', 'this', 'return value', 'name'],
                  correctIndex: 1,
                  explanation: 'Arrow functions inherit `this` from the enclosing lexical scope.',
                },
                {
                  question: 'Which call style invokes a function immediately?',
                  options: ['fn', 'fn()', 'new fn', 'typeof fn'],
                  correctIndex: 1,
                  explanation: 'Parentheses are the call operator.',
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const reactCourse = await seedCourse({
    instructor: ada,
    course: {
      title: 'React Crash Course',
      shortDescription:
        'Build real React components with hooks, state, and effects in a weekend.',
      description:
        'A pragmatic intro to React for developers who already know JavaScript. We focus on the modern function-component + hooks story and skip every legacy class-component tangent.',
      price: 39.99,
      category: 'programming',
      level: 'intermediate',
      tags: ['react', 'hooks', 'frontend', 'spa'],
      requirements: ['Comfortable with modern JavaScript (ES6+)'],
      learningOutcomes: [
        'Compose UIs with function components and props',
        'Manage local state with `useState`',
        'Synchronize side-effects with `useEffect`',
      ],
      status: 'published',
    },
    sections: [
      {
        title: 'React Fundamentals',
        order: 0,
        lessons: [
          {
            title: 'What is React?',
            type: 'text',
            order: 0,
            duration: 240,
            isFreePreview: true,
            content:
              'React is a library for building UIs as a tree of small, composable components. It does not prescribe routing, data-fetching, or state management — pick those separately.',
          },
          {
            title: 'Components and Props',
            type: 'text',
            order: 1,
            duration: 360,
            content:
              'A component is a function that returns JSX. Props are its read-only inputs. Lift state up; pass data down.',
          },
        ],
      },
      {
        title: 'Hooks and State',
        order: 1,
        lessons: [
          {
            title: 'useState in Practice',
            type: 'video',
            order: 0,
            duration: 600,
            videoUrl: SAMPLE_VIDEO_BIG_BUCK_BUNNY,
          },
          {
            title: 'useEffect Patterns',
            type: 'video',
            order: 1,
            duration: 660,
            videoUrl: SAMPLE_VIDEO_ELEPHANTS_DREAM,
            quiz: {
              title: 'Hooks self-check',
              passingScore: 70,
              timeLimitSeconds: 240,
              questions: [
                {
                  question: 'What does the dependency array of `useEffect` control?',
                  options: [
                    'The order in which hooks run',
                    'When the effect re-runs',
                    'Whether the component re-renders',
                    'The return type of the effect',
                  ],
                  correctIndex: 1,
                  explanation:
                    'The effect re-runs whenever any value in the dependency array changes between renders.',
                },
                {
                  question: 'A function returned from an effect runs…',
                  options: [
                    'On every render',
                    'On unmount and before the next effect',
                    'Only once on mount',
                    'Never — it is reserved for future use',
                  ],
                  correctIndex: 1,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const dataCourse = await seedCourse({
    instructor: ben,
    course: {
      title: 'Data Science with Python',
      shortDescription:
        'NumPy, Pandas, and the data-wrangling muscle every analyst needs.',
      description:
        'Hands-on Python for data work. We start with the toolchain (Jupyter, Pandas, NumPy), then move into real cleaning and reshaping problems pulled from messy production datasets.',
      price: 59.99,
      category: 'data-science',
      level: 'intermediate',
      tags: ['python', 'pandas', 'numpy', 'analytics'],
      requirements: ['Basic Python syntax', 'High-school algebra'],
      learningOutcomes: [
        'Set up a reproducible Python data environment',
        'Reshape DataFrames with Pandas confidently',
        'Vectorize calculations with NumPy',
      ],
      status: 'published',
    },
    sections: [
      {
        title: 'Tooling',
        order: 0,
        lessons: [
          {
            title: 'Python and Jupyter Setup',
            type: 'text',
            order: 0,
            duration: 300,
            isFreePreview: true,
            content:
              'We will use Python 3.11+ with `uv` (or `pip`) for env management and Jupyter Lab as the notebook surface.',
          },
        ],
      },
      {
        title: 'Data Wrangling',
        order: 1,
        lessons: [
          {
            title: 'Pandas DataFrames',
            type: 'video',
            order: 0,
            duration: 720,
            videoUrl: SAMPLE_VIDEO_BIG_BUCK_BUNNY,
          },
          {
            title: 'NumPy Essentials',
            type: 'text',
            order: 1,
            duration: 480,
            content:
              'NumPy gives you a contiguous, typed array — the foundation Pandas, scikit-learn, and PyTorch all build on. Vectorize everything; loops are a code smell here.',
            quiz: {
              title: 'NumPy quick check',
              passingScore: 60,
              timeLimitSeconds: 180,
              questions: [
                {
                  question: 'Which structure is the foundation of NumPy?',
                  options: ['list', 'tuple', 'ndarray', 'dict'],
                  correctIndex: 2,
                },
                {
                  question: 'Element-wise operations on NumPy arrays are called…',
                  options: ['Boxing', 'Vectorization', 'Iteration', 'Recursion'],
                  correctIndex: 1,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const uxCourse = await seedCourse({
    instructor: clara,
    course: {
      title: 'UX Design Foundations',
      shortDescription:
        'From user research to wireframes — the design process every team should run.',
      description:
        'A foundations course for designers, PMs, and engineers who want to ship products people actually use. We work through a single small product end-to-end: research → personas → wireframes → prototype.',
      price: 29.99,
      category: 'design',
      level: 'beginner',
      tags: ['ux', 'ui', 'figma', 'research'],
      requirements: ['No prior design experience required'],
      learningOutcomes: [
        'Run a basic user-interview script',
        'Translate research into actionable personas',
        'Sketch wireframes and prototype them in Figma',
      ],
      status: 'published',
    },
    sections: [
      {
        title: 'Design Thinking',
        order: 0,
        lessons: [
          {
            title: 'Empathy and Research',
            type: 'text',
            order: 0,
            duration: 300,
            isFreePreview: true,
            content:
              'Design starts with listening. We will cover lightweight, low-cost research methods that fit into a real product schedule.',
          },
          {
            title: 'Persona Building',
            type: 'text',
            order: 1,
            duration: 360,
            content:
              'Personas are a tool for communicating research, not a substitute for it. We will build one from the interviews in the previous lesson.',
          },
        ],
      },
      {
        title: 'Wireframing',
        order: 1,
        lessons: [
          {
            title: 'Low-fidelity Wireframes',
            type: 'video',
            order: 0,
            duration: 540,
            videoUrl: SAMPLE_VIDEO_BIG_BUCK_BUNNY,
          },
          {
            title: 'Prototyping in Figma',
            type: 'video',
            order: 1,
            duration: 720,
            videoUrl: SAMPLE_VIDEO_ELEPHANTS_DREAM,
            quiz: {
              title: 'Wireframing recap',
              passingScore: 70,
              timeLimitSeconds: 240,
              questions: [
                {
                  question: 'Why start in low fidelity?',
                  options: [
                    'It looks more professional',
                    'It encourages fast iteration on structure',
                    'Clients prefer grayscale',
                    'It avoids the need for research',
                  ],
                  correctIndex: 1,
                  explanation:
                    'Low fidelity keeps the conversation about layout and flow, not pixels.',
                },
                {
                  question: 'A prototype is primarily used to…',
                  options: [
                    'Replace production code',
                    'Validate flows with real users',
                    'Document final visual specs',
                    'Track project deadlines',
                  ],
                  correctIndex: 1,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  // A draft course so the instructor dashboard / admin moderation queue
  // has something realistic to show.
  await seedCourse({
    instructor: clara,
    course: {
      title: 'Digital Marketing 101',
      shortDescription:
        'Channels, funnels, and metrics — the marketing basics every founder needs.',
      description:
        'A draft course (still in progress) that walks through the modern digital-marketing stack: SEO, paid ads, email, and analytics. Useful for testing the moderation workflow.',
      price: 19.99,
      category: 'marketing',
      level: 'beginner',
      tags: ['marketing', 'seo', 'analytics'],
      requirements: ['No prior marketing experience'],
      learningOutcomes: [
        'Map the customer acquisition funnel',
        'Pick the right channel for the right stage',
      ],
      status: 'draft',
    },
    sections: [
      {
        title: 'Channel Overview',
        order: 0,
        lessons: [
          {
            title: 'SEO Basics',
            type: 'text',
            order: 0,
            duration: 240,
            content:
              'SEO is about earning attention from search engines by being the most useful answer to a real query. Keywords matter; intent matters more.',
          },
        ],
      },
    ],
  });

  // --- Enrollments -------------------------------------------------------
  const [daniel, emma, felix, grace, henry] = students;

  await enrollStudent(daniel, jsCourse, [
    'Welcome to JavaScript',
    'Setting Up Your Environment',
    'Variables and Types',
  ]);
  await enrollStudent(daniel, reactCourse, ['What is React?']);

  await enrollStudent(emma, dataCourse, [
    'Python and Jupyter Setup',
    'Pandas DataFrames',
  ]);
  await enrollStudent(emma, jsCourse, []);

  await enrollStudent(felix, jsCourse, [
    'Welcome to JavaScript',
    'Setting Up Your Environment',
    'Variables and Types',
    'Control Flow',
    'Functions and Scope',
  ]);
  await enrollStudent(felix, reactCourse, [
    'What is React?',
    'Components and Props',
    'useState in Practice',
  ]);

  await enrollStudent(grace, uxCourse, [
    'Empathy and Research',
    'Persona Building',
  ]);

  await enrollStudent(henry, uxCourse, []);
  await enrollStudent(henry, dataCourse, []);

  log('Demo dataset complete.');
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const run = async () => {
  await connectDB();
  await seedAdmin();
  if (SEED_DEMO) await seedDemo();
  return exitWith(0, SEED_DEMO ? 'Admin + demo seed finished.' : 'Admin seed finished.');
};

run().catch(async (e) => {
  err('Seeder failed:', e?.message || e);
  await exitWith(1);
});
