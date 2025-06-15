import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../Card'; // Adjust

describe('Card Components', () => {
  test('Card renders children', () => {
    render(<Card><div>Card Content</div></Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  test('Card applies className prop', () => {
    const { container } = render(<Card className="custom-card-class">Test</Card>);
    // First child of container is often the Card div itself
    expect(container.firstChild).toHaveClass('custom-card-class');
  });

  test('CardHeader renders children', () => {
    render(<CardHeader><div>Header Content</div></CardHeader>);
    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  test('CardHeader applies className prop', () => {
    const { container } = render(<CardHeader className="custom-header-class">Test</CardHeader>);
    expect(container.firstChild).toHaveClass('custom-header-class');
  });

  test('CardTitle renders children and applies default heading role (h3 implied by component)', () => {
    render(<CardTitle>My Title</CardTitle>);
    // Shadcn CardTitle renders an h3
    expect(screen.getByRole('heading', { name: /My Title/i, level: 3 })).toBeInTheDocument();
  });

  test('CardTitle applies className prop', () => {
    render(<CardTitle className="custom-title-class">My Title</CardTitle>);
    expect(screen.getByRole('heading', { name: /My Title/i })).toHaveClass('custom-title-class');
  });

  test('CardDescription renders children', () => {
    render(<CardDescription>My Description</CardDescription>);
    expect(screen.getByText('My Description')).toBeInTheDocument();
  });

  test('CardDescription applies className prop', () => {
    render(<CardDescription className="custom-description-class">My Description</CardDescription>);
    expect(screen.getByText('My Description')).toHaveClass('custom-description-class');
  });

  test('CardContent renders children', () => {
    render(<CardContent><div>Main Content Area</div></CardContent>);
    expect(screen.getByText('Main Content Area')).toBeInTheDocument();
  });

  test('CardContent applies className prop', () => {
    const { container } = render(<CardContent className="custom-content-class">Test</CardContent>);
    expect(container.firstChild).toHaveClass('custom-content-class');
  });

  test('CardFooter renders children', () => {
    render(<CardFooter><div>Footer Content</div></CardFooter>);
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  test('CardFooter applies className prop', () => {
     const { container } = render(<CardFooter className="custom-footer-class">Test</CardFooter>);
    expect(container.firstChild).toHaveClass('custom-footer-class');
  });

  test('Full card structure renders correctly', () => {
    render(
      <Card data-testid="full-card">
        <CardHeader>
          <CardTitle>Full Card Title</CardTitle>
          <CardDescription>Full Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This is the full card content.</p>
        </CardContent>
        <CardFooter>
          <p>Full Card Footer</p>
        </CardFooter>
      </Card>
    );
    expect(screen.getByRole('heading', { name: /Full Card Title/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Full Card Description')).toBeInTheDocument();
    expect(screen.getByText('This is the full card content.')).toBeInTheDocument();
    expect(screen.getByText('Full Card Footer')).toBeInTheDocument();
    expect(screen.getByTestId('full-card')).toBeInTheDocument();
  });
});
