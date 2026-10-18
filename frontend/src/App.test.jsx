import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the shortener card', () => {
  render(<App />);
  expect(screen.getByText('Shorten a long link')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Get your link' })).toBeInTheDocument();
});
