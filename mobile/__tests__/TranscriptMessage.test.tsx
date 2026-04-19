import React from 'react';
import { render } from '@testing-library/react-native';
import TranscriptMessage from '../components/TranscriptMessage';

describe('TranscriptMessage', () => {
  it('renders content text', () => {
    const { getByText } = render(
      <TranscriptMessage role="assistant" content="Hello, how can I help?" speakerLabel="Homeowner" />
    );
    expect(getByText('Hello, how can I help?')).toBeTruthy();
  });

  it('renders speaker label for assistant', () => {
    const { getByText } = render(
      <TranscriptMessage role="assistant" content="Hi" speakerLabel="Homeowner" />
    );
    expect(getByText('Homeowner')).toBeTruthy();
  });

  it('renders You label for user', () => {
    const { getByText } = render(
      <TranscriptMessage role="user" content="Hi" speakerLabel="Homeowner" />
    );
    expect(getByText('You')).toBeTruthy();
  });
});
