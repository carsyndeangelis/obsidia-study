import { describe, it, expect } from 'vitest';
const { buildPrompt } = require('../api/prompts');

describe('buildPrompt', () => {
  it('returns general prompt for unknown page', () => {
    const result = buildPrompt('nonexistent', {});
    expect(result).toContain('General Chat mode');
  });

  it('returns general prompt when no page specified', () => {
    const result = buildPrompt(undefined, {});
    expect(result).toContain('General Chat mode');
  });

  it('always includes BASE prompt', () => {
    const pages = ['general', 'math', 'essay', 'study', 'notes', 'doublecheck', 'grading', 'testprep', 'teacher'];
    pages.forEach(page => {
      const result = buildPrompt(page, {});
      expect(result).toContain('Obsidia AI');
      expect(result).toContain('academic assistant');
    });
  });

  describe('math page', () => {
    it('substitutes mathType variable', () => {
      const result = buildPrompt('math', { mathType: 'calculus', mode: 'solve' });
      expect(result).toContain('calculus');
      expect(result).not.toContain('{{mathType}}');
    });

    it('substitutes mode variable', () => {
      const result = buildPrompt('math', { mode: 'explain' });
      expect(result).toContain('explain');
      expect(result).not.toContain('{{mode}}');
    });

    it('cleans unused template variables', () => {
      const result = buildPrompt('math', {});
      expect(result).not.toContain('{{');
      expect(result).not.toContain('}}');
    });
  });

  describe('essay page', () => {
    it('handles humanizer=true conditional', () => {
      const result = buildPrompt('essay', { humanizer: true, grade: '10th', mode: 'draft' });
      expect(result).toContain('naturally');
      expect(result).toContain('vary sentence length');
    });

    it('handles humanizer=false conditional', () => {
      const result = buildPrompt('essay', { humanizer: false, grade: '11th', mode: 'draft' });
      expect(result).toContain('academic tone');
    });

    it('substitutes grade level', () => {
      const result = buildPrompt('essay', { grade: '9th', mode: 'outline' });
      expect(result).toContain('9th');
    });
  });

  describe('study page', () => {
    it('includes flashcard JSON instruction', () => {
      const result = buildPrompt('study', { method: 'flashcards' });
      expect(result).toContain('JSON array');
    });

    it('includes cornell method', () => {
      const result = buildPrompt('study', { method: 'cornell' });
      expect(result).toContain('cornell');
    });
  });

  describe('adaptive difficulty (F5)', () => {
    it('appends skill context when provided', () => {
      const result = buildPrompt('math', {
        mode: 'practice',
        mathType: 'algebra',
        skillContext: 'Math > Algebra: Level 4/5 (Advanced), 8/10 correct'
      });
      expect(result).toContain('STUDENT SKILL PROFILE');
      expect(result).toContain('Level 4/5');
      expect(result).toContain('Adapt your difficulty');
    });

    it('does not append skill context when absent', () => {
      const result = buildPrompt('math', { mode: 'solve', mathType: 'algebra' });
      expect(result).not.toContain('STUDENT SKILL PROFILE');
    });
  });

  describe('document context (F4)', () => {
    it('appends document context when provided', () => {
      const result = buildPrompt('general', {
        documentContext: 'Chapter 3: Photosynthesis is the process by which...'
      });
      expect(result).toContain('DOCUMENT CONTEXT');
      expect(result).toContain('Photosynthesis');
    });

    it('does not append document context when absent', () => {
      const result = buildPrompt('general', {});
      expect(result).not.toContain('DOCUMENT CONTEXT');
    });
  });

  it('handles all teacher tools', () => {
    const tools = ['lesson', 'rubric', 'quizgen', 'stfeedback', 'differentiate', 'parentemail'];
    tools.forEach(tool => {
      const result = buildPrompt('teacher', { tool });
      expect(result).not.toContain('{{tool}}');
    });
  });

  it('handles all doublecheck modes', () => {
    const modes = ['verify', 'sources', 'compare', 'bias'];
    modes.forEach(mode => {
      const result = buildPrompt('doublecheck', { mode });
      expect(result).not.toContain('{{mode}}');
    });
  });

  it('handles all testprep sections', () => {
    const sections = ['act-math', 'act-english', 'act-science', 'sat-math', 'sat-rw', 'strategy'];
    sections.forEach(section => {
      const result = buildPrompt('testprep', { section });
      expect(result).not.toContain('{{section}}');
    });
  });
});
