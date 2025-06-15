import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button'; // Adjust import path if necessary

describe('Button Component', () => {
  test('renders button with children', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /Click Me/i })).toBeInTheDocument();
  });

  test('applies variant classes (conceptual test, actual classes depend on cva)', () => {
    // This test is conceptual as we don't know the exact classes.
    // A snapshot test or checking for a base class might be more practical.
    // For now, we just check if the button renders with the given text.
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  test('handles onClick event', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByText(/Submit/i));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    expect(screen.getByRole('button', { name: /Disabled Button/i })).toBeDisabled();
  });

  test('renders as child component when asChild prop is true', () => {
    render(
      <Button asChild>
        <a href="/home">Go Home</a>
      </Button>
    );
    // Check if it renders an anchor tag with the correct text
    // Note: The role might still be 'button' if the underlying Slot behavior doesn't change it,
    // or it might be 'link'. Testing for the text and presence of an anchor tag's href is robust.
    const linkElement = screen.getByText(/Go Home/i);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement.closest('a')).toHaveAttribute('href', '/home');
  });
});
