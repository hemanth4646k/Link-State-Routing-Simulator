import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Link State Routing Simulator', () => {
  render(<App />);
  const titleElement = screen.getByText(/Link State Routing Simulator/i);
  expect(titleElement).toBeInTheDocument();
});
