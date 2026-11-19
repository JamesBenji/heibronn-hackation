import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewStage from '../components/ReviewStage.jsx';
import FinishStage from '../components/FinishStage.jsx';
import SetupStage from '../components/SetupStage.jsx';
import RevealBox from '../components/RevealBox.jsx';

// ── RevealBox ────────────────────────────────────────────────────────────────

describe('RevealBox', () => {
  it('renders a progress bar at 0% when progress is 0', () => {
    render(<RevealBox answer="Hello world" progress={0} thinkMs={3000} revealMs={26000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders progress bar at 100% when fully revealed', () => {
    render(<RevealBox answer="Hello" progress={3000 + 26000} thinkMs={3000} revealMs={26000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders zero opacity characters during the thinking period', () => {
    const { container } = render(
      <RevealBox answer="Hi" progress={1000} thinkMs={3000} revealMs={26000} />
    );
    const spans = container.querySelectorAll('.reveal-text span');
    spans.forEach(span => {
      expect(span.style.opacity).toBe('0');
    });
  });
});

// ── ReviewStage ──────────────────────────────────────────────────────────────

const sampleItems = [
  { question: 'What is active recall?', answer: 'Retrieving from memory.', excerpt: 'Active recall means…' },
  { question: 'What is spaced repetition?', answer: 'Reviewing over intervals.', excerpt: 'Spaced repetition…' },
];

describe('ReviewStage', () => {
  it('renders all items', () => {
    render(<ReviewStage items={sampleItems} onItemsChange={() => {}} onBegin={() => {}} onRestart={() => {}} />);
    expect(screen.getByText('What is active recall?')).toBeInTheDocument();
    expect(screen.getByText('What is spaced repetition?')).toBeInTheDocument();
  });

  it('calls onItemsChange with item removed when Remove is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<ReviewStage items={sampleItems} onItemsChange={handler} onBegin={() => {}} onRestart={() => {}} />);
    const removeButtons = screen.getAllByText('Remove');
    await user.click(removeButtons[0]);
    expect(handler).toHaveBeenCalledWith([sampleItems[1]]);
  });

  it('disables Begin button when no items remain', () => {
    render(<ReviewStage items={[]} onItemsChange={() => {}} onBegin={() => {}} onRestart={() => {}} />);
    expect(screen.getByRole('button', { name: /begin recalling/i })).toBeDisabled();
  });

  it('calls onBegin when Begin button is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<ReviewStage items={sampleItems} onItemsChange={() => {}} onBegin={handler} onRestart={() => {}} />);
    await user.click(screen.getByRole('button', { name: /begin recalling/i }));
    expect(handler).toHaveBeenCalled();
  });

  it('calls onRestart when Start over is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<ReviewStage items={sampleItems} onItemsChange={() => {}} onBegin={() => {}} onRestart={handler} />);
    await user.click(screen.getByRole('button', { name: /start over/i }));
    expect(handler).toHaveBeenCalled();
  });
});

// ── FinishStage ──────────────────────────────────────────────────────────────

describe('FinishStage', () => {
  it('shows recalled count in non-demo mode', () => {
    render(<FinishStage recalled={2} total={3} demo={false} onRestart={() => {}} />);
    expect(screen.getByText(/You recalled 2 of 3/)).toBeInTheDocument();
  });

  it('shows demo message in demo mode', () => {
    render(<FinishStage recalled={0} total={3} demo={true} onRestart={() => {}} />);
    expect(screen.getByText(/Add an AI key/)).toBeInTheDocument();
  });

  it('calls onRestart when button is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<FinishStage recalled={1} total={2} demo={false} onRestart={handler} />);
    await user.click(screen.getByRole('button', { name: /review another/i }));
    expect(handler).toHaveBeenCalled();
  });
});

// ── SetupStage ───────────────────────────────────────────────────────────────

describe('SetupStage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the textarea and upload button', () => {
    render(<SetupStage aiReady={true} onItems={() => {}} />);
    expect(screen.getByRole('textbox', { name: /study material/i })).toBeInTheDocument();
    expect(screen.getByText(/upload .txt or .md/i)).toBeInTheDocument();
  });

  it('shows AI not configured notice when aiReady is false', () => {
    render(<SetupStage aiReady={false} onItems={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toMatch(/not configured/i);
  });

  it('shows validation error when source is too short', async () => {
    const user = userEvent.setup();
    render(<SetupStage aiReady={true} onItems={() => {}} />);
    await user.click(screen.getByRole('button', { name: /make my questions/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/150 to 40,000/);
  });

  it('calls onItems with sampleItems when Try the sample is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<SetupStage aiReady={true} onItems={handler} />);
    await user.click(screen.getByRole('button', { name: /try the sample/i }));
    expect(handler).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ question: expect.any(String) })]), true);
  });

  it('shows character count as user types', async () => {
    const user = userEvent.setup();
    render(<SetupStage aiReady={true} onItems={() => {}} />);
    const textarea = screen.getByRole('textbox', { name: /study material/i });
    await user.type(textarea, 'hello');
    expect(screen.getByText(/5 \/ 40,000 characters/)).toBeInTheDocument();
  });

  it('calls fetch and passes items to onItems when source is valid', async () => {
    const user = userEvent.setup();
    const mockItems = [{ question: 'Q?', answer: 'A.', excerpt: 'E.' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    });
    const handler = vi.fn();
    render(<SetupStage aiReady={true} onItems={handler} />);
    const textarea = screen.getByRole('textbox', { name: /study material/i });
    await user.type(textarea, 'x'.repeat(150));
    await user.click(screen.getByRole('button', { name: /make my questions/i }));
    await waitFor(() => expect(handler).toHaveBeenCalledWith(mockItems, false));
  });

  it('shows server error message when fetch fails', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Service unavailable.' }),
    });
    render(<SetupStage aiReady={true} onItems={() => {}} />);
    const textarea = screen.getByRole('textbox', { name: /study material/i });
    await user.type(textarea, 'x'.repeat(150));
    await user.click(screen.getByRole('button', { name: /make my questions/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable.');
  });
});
