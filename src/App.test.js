import { render, screen } from '@testing-library/react';
import App from './App';

test('renders DFA/NFA Visualizer title', () => {
  render(<App />);
  const titleElement = screen.getByText(/DFA\/NFA Visualizer/i);
  expect(titleElement).toBeInTheDocument();
});
