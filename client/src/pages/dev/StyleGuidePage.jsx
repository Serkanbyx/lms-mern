/**
 * `/styleguide` — visual catalogue of every UI primitive.
 *
 * This page is a "Storybook-lite" — gated to dev (`import.meta.env.DEV`)
 * by the route definition. It composes every primitive in every variant
 * so we can eyeball regressions during development without spinning up
 * a separate documentation site.
 *
 * Pages should never reach into this file; it exists purely as a manual
 * QA surface.
 */

import { useState } from 'react';
import {
  Accordion,
  Alert,
  Avatar,
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  ChipInput,
  ConfirmModal,
  Divider,
  Drawer,
  Dropdown,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  Input,
  KBD,
  Modal,
  Pagination,
  Popover,
  ProgressBar,
  ProgressRing,
  Radio,
  Rating,
  RoleBadge,
  Select,
  Sheet,
  Skeleton,
  Slider,
  Spinner,
  Stat,
  StatusBadge,
  Tabs,
  Textarea,
  toast,
  Toggle,
  Tooltip,
} from '../../components/ui/index.js';
import { Logo, LogoMark } from '../../components/brand/index.js';

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-base font-semibold text-text border-b border-border pb-1.5">
      {title}
    </h2>
    <div className="flex flex-wrap items-start gap-3">{children}</div>
  </section>
);

export default function StyleGuidePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [chips, setChips] = useState(['react', 'tailwind']);
  const [slider, setSlider] = useState(40);
  const [toggle, setToggle] = useState(true);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-text-muted">Style guide · dev only</span>
        </div>
        <Badge variant="warning">DEV</Badge>
      </header>

      <Section title="Brand">
        <Logo />
        <LogoMark size={48} />
      </Section>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
        <Button loading>Loading</Button>
        <Button leftIcon={<Icon name="Plus" size={16} />}>With icon</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <IconButton aria-label="Search">
          <Icon name="Search" size={18} />
        </IconButton>
      </Section>

      <Section title="Inputs">
        <div className="w-full grid gap-4 md:grid-cols-2">
          <FormField label="Email" helper="We'll never share it">
            {(p) => <Input placeholder="you@example.com" {...p} />}
          </FormField>
          <FormField label="Password" required error="Password is too short">
            {(p) => <Input type="password" placeholder="••••••" {...p} />}
          </FormField>
          <FormField label="Bio">
            {(p) => (
              <Textarea
                autosize
                maxLength={140}
                showCounter
                placeholder="Tell us about you…"
                {...p}
              />
            )}
          </FormField>
          <FormField label="Role">
            {(p) => (
              <Select
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'instructor', label: 'Instructor' },
                ]}
                {...p}
              />
            )}
          </FormField>
          <FormField label="Tags">
            {() => <ChipInput value={chips} onChange={setChips} />}
          </FormField>
          <FormField label="Volume">
            {() => (
              <Slider
                value={slider}
                onChange={setSlider}
                formatValue={(v) => `${v}%`}
              />
            )}
          </FormField>
        </div>
        <div className="flex items-center gap-6">
          <Checkbox label="Remember me" />
          <Checkbox label="Indeterminate" indeterminate />
          <Radio label="Option A" name="demo" />
          <Radio label="Option B" name="demo" defaultChecked />
          <Toggle
            checked={toggle}
            onChange={setToggle}
            label="Notifications"
          />
        </div>
      </Section>

      <Section title="Badges & Avatars">
        <Badge>neutral</Badge>
        <Badge variant="primary">primary</Badge>
        <Badge variant="success">success</Badge>
        <Badge variant="warning">warning</Badge>
        <Badge variant="danger">danger</Badge>
        <Badge variant="info">info</Badge>
        <StatusBadge status="published" />
        <StatusBadge status="pending" />
        <StatusBadge status="rejected" />
        <RoleBadge role="student" />
        <RoleBadge role="instructor" />
        <RoleBadge role="admin" />
        <Avatar name="Ada Lovelace" size="sm" />
        <Avatar name="Linus Torvalds" />
        <Avatar name="Grace Hopper" size="lg" ring />
      </Section>

      <Section title="Cards & Stats">
        <Card className="w-64">
          <h3 className="text-sm font-semibold text-text">Default card</h3>
          <p className="text-xs text-text-muted mt-1">
            Surface container with consistent padding.
          </p>
        </Card>
        <Card interactive className="w-64">
          <h3 className="text-sm font-semibold text-text">Interactive</h3>
          <p className="text-xs text-text-muted mt-1">Hover lifts the card.</p>
        </Card>
        <Stat label="Enrollments" value={1284} delta={12} hint="vs last week" />
        <Stat label="Revenue" value={4820} delta={-3} format={(v) => `$${v}`} />
      </Section>

      <Section title="Feedback">
        <Spinner />
        <Spinner size="lg" label="Loading…" />
        <Skeleton width={200} height={16} />
        <Skeleton variant="circle" width={40} height={40} />
        <div className="w-64 space-y-3">
          <ProgressBar value={15} showLabel label="Browsing" />
          <ProgressBar value={62} showLabel label="In progress" />
          <ProgressBar value={100} showLabel label="Completed" />
          <ProgressBar indeterminate showLabel label="Syncing" />
        </div>
        <ProgressRing value={72} />
        <Rating value={4.5} count={1284} />
      </Section>

      <Section title="Alerts & Banners">
        <Alert variant="info" title="FYI">
          You can change this later in Settings.
        </Alert>
        <Alert variant="success" title="Saved">
          Your profile has been updated.
        </Alert>
        <Alert variant="warning" title="Heads up">
          Your trial ends in 3 days.
        </Alert>
        <Alert variant="danger" title="Action required" onDismiss={() => {}}>
          We couldn&rsquo;t verify your payment method.
        </Alert>
        <Banner variant="primary">
          A new release is available. <KBD>R</KBD> to reload.
        </Banner>
      </Section>

      <Section title="Tooltip / KBD / Divider">
        <Tooltip content="Search">
          <IconButton aria-label="Search">
            <Icon name="Search" size={18} />
          </IconButton>
        </Tooltip>
        <KBD>⌘K</KBD>
        <KBD>Esc</KBD>
        <div className="w-full">
          <Divider label="OR" />
        </div>
      </Section>

      <Section title="Breadcrumbs / Pagination">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Courses', to: '/courses' },
            { label: 'React Basics' },
          ]}
        />
        <Pagination page={page} pageCount={12} onPageChange={setPage} />
      </Section>

      <Section title="Tabs / Accordion">
        <div className="w-full max-w-xl">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'overview', label: 'Overview' },
              { id: 'curriculum', label: 'Curriculum' },
              { id: 'reviews', label: 'Reviews' },
            ]}
          >
            <p className="text-sm text-text-muted">
              Active tab: <strong>{tab}</strong>
            </p>
          </Tabs>
        </div>
        <div className="w-full max-w-xl">
          <Accordion
            defaultOpen="s1"
            items={[
              {
                id: 's1',
                title: 'Section 1 — Getting started',
                meta: '3 lessons',
                content: 'Intro to the platform, environment setup.',
              },
              {
                id: 's2',
                title: 'Section 2 — Components',
                meta: '5 lessons',
                content: 'Building blocks of the UI.',
              },
            ]}
          />
        </div>
      </Section>

      <Section title="Overlays">
        <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Confirm danger
        </Button>
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
          Open Drawer
        </Button>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open Sheet
        </Button>
        <Popover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          trigger={<Button variant="outline">Open Popover</Button>}
        >
          <div className="p-3 text-sm">Hello from a popover.</div>
        </Popover>
        <Dropdown
          trigger={<Button variant="outline">Menu</Button>}
          items={[
            { id: 'a', label: 'Profile', icon: 'User' },
            { id: 'b', label: 'Settings', icon: 'Settings', shortcut: '⌘,' },
            { id: 'sep', separator: true },
            { id: 'c', label: 'Logout', icon: 'LogOut', danger: true },
          ]}
        />
      </Section>

      <Section title="Toasts">
        <Button onClick={() => toast.success('Saved!')}>Success</Button>
        <Button onClick={() => toast.error('Something failed.')}>Error</Button>
        <Button onClick={() => toast.info('Heads up.')}>Info</Button>
        <Button
          onClick={() =>
            toast.promise(new Promise((res) => setTimeout(res, 1500)), {
              loading: 'Saving…',
              success: 'Saved',
              error: 'Failed',
            })
          }
        >
          Promise
        </Button>
      </Section>

      <Section title="Empty state">
        <div className="w-full">
          <EmptyState
            icon="Search"
            title="No results"
            description="Try a different search term or clear filters."
            action={<Button variant="secondary">Clear filters</Button>}
          />
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal title"
        description="A short description goes here."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>Save</Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Modal body content. Focus is trapped inside, scroll is locked,
          and pressing Esc closes.
        </p>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Delete this course?"
        description="This action can't be undone. All enrolments will be removed."
        confirmLabel="Delete"
        danger
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
      >
        <p className="text-sm text-text-muted">Drawer body…</p>
      </Drawer>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Actions">
        <p className="text-sm text-text-muted">Bottom sheet body…</p>
      </Sheet>
    </div>
  );
}
