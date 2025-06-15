import React from 'react';
import { render, screen } from '@testing-library/react';
import { Label } from '../Label'; // Adjust import path

describe('Label Component', () => {
  test('renders label with children as text', () => {
    render(<Label htmlFor="testInput">Test Label</Label>);
    const labelElement = screen.getByText('Test Label');
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveAttribute('for', 'testInput');
  });

  test('renders label with associated input (conceptual via htmlFor)', () => {
    render(
      <>
        <Label htmlFor="username">Username</Label>
        <input id="username" type="text" />
      </>
    );
    // getByLabelText finds the input associated with the label.
    expect(screen.getByLabelText('Username')).toHaveAttribute('id', 'username');
  });

  test('applies className prop', () => {
    render(<Label className="custom-label-class" htmlFor="anotherInput">Another Label</Label>);
    expect(screen.getByText('Another Label')).toHaveClass('custom-label-class');
  });
});
