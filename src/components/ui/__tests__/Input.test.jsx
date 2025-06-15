import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input'; // Adjust import path

describe('Input Component', () => {
  test('renders input element', () => {
    render(<Input data-testid="test-input" />);
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-input')).toBeInstanceOf(HTMLInputElement);
  });

  test('renders with specified type', () => {
    render(<Input type="password" data-testid="password-input" />);
    expect(screen.getByTestId('password-input')).toHaveAttribute('type', 'password');
  });

  test('handles onChange event', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} data-testid="change-input" />);
    fireEvent.change(screen.getByTestId('change-input'), { target: { value: 'test value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    // expect(screen.getByTestId('change-input')).toHaveValue('test value'); // For uncontrolled
  });

  test('displays placeholder text', () => {
    render(<Input placeholder="Enter text here" data-testid="placeholder-input" />);
    expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
  });

  test('is disabled when disabled prop is true', () => {
    render(<Input disabled data-testid="disabled-input" />);
    expect(screen.getByTestId('disabled-input')).toBeDisabled();
  });

  test('applies className prop', () => {
    render(<Input className="custom-class" data-testid="class-input" />);
    expect(screen.getByTestId('class-input')).toHaveClass('custom-class');
  });
});
