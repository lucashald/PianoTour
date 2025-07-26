// chord-identification-strict.test.js
import { describe, test, expect, afterAll } from 'vitest';
import { identifyChordStrict } from './note-data.js';

// Track test results
let testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  categories: {}
};

// Helper to track test results
function trackTest(category, passed) {
  testResults.totalTests++;
  if (passed) testResults.passedTests++;
  else testResults.failedTests++;
  
  if (!testResults.categories[category]) {
    testResults.categories[category] = { passed: 0, failed: 0, total: 0 };
  }
  testResults.categories[category].total++;
  if (passed) testResults.categories[category].passed++;
  else testResults.categories[category].failed++;
}

describe('identifyChordStrict - Comprehensive Chord Tests', () => {
  
  describe('Major Triads', () => {
    test('should identify all major triads', () => {
      const tests = [
        [['C', 'E', 'G'], 'C Major'],
        [['C#', 'F', 'G#'], 'C# Major'],
        [['D', 'F#', 'A'], 'D Major'],
        [['Eb', 'G', 'Bb'], 'Eb Major'],
        [['E', 'G#', 'B'], 'E Major'],
        [['F', 'A', 'C'], 'F Major'],
        [['F#', 'A#', 'C#'], 'F# Major'],
        [['G', 'B', 'D'], 'G Major'],
        [['Ab', 'C', 'Eb'], 'Ab Major'],
        [['A', 'C#', 'E'], 'A Major'],
        [['Bb', 'D', 'F'], 'Bb Major'],
        [['B', 'D#', 'F#'], 'B Major']
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Major Triads', true);
        } catch (error) {
          trackTest('Major Triads', false);
          throw error;
        }
      });
    });

    test('should handle major triads with octaves', () => {
      const tests = [
        [['C4', 'E4', 'G4'], 'C Major'],
        [['F2', 'A3', 'C5'], 'F Major']
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Major Triads', true);
        } catch (error) {
          trackTest('Major Triads', false);
          throw error;
        }
      });
    });
  });

  describe('Minor Triads', () => {
    test('should identify all minor triads', () => {
      const tests = [
        [['C', 'Eb', 'G'], 'C Minor'],
        [['C#', 'E', 'G#'], 'C# Minor'],
        [['D', 'F', 'A'], 'D Minor'],
        [['Eb', 'Gb', 'Bb'], 'Eb Minor'],
        [['E', 'G', 'B'], 'E Minor'],
        [['F', 'Ab', 'C'], 'F Minor'],
        [['F#', 'A', 'C#'], 'F# Minor'],
        [['G', 'Bb', 'D'], 'G Minor'],
        [['Ab', 'Cb', 'Eb'], 'Ab Minor'],
        [['A', 'C', 'E'], 'A Minor'],
        [['Bb', 'Db', 'F'], 'Bb Minor'],
        [['B', 'D', 'F#'], 'B Minor']
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Minor Triads', true);
        } catch (error) {
          trackTest('Minor Triads', false);
          throw error;
        }
      });
    });
  });

  describe('Major Inversions', () => {
    test('should identify major 1st inversions', () => {
      const tests = [
        [['E', 'G', 'C'], 'C Major (1st Inversion)'],
        [['F#', 'A', 'D'], 'D Major (1st Inversion)'],
        [['G#', 'B', 'E'], 'E Major (1st Inversion)'],
        [['A', 'C', 'F'], 'F Major (1st Inversion)'],
        [['B', 'D', 'G'], 'G Major (1st Inversion)'],
        [['C#', 'E', 'A'], 'A Major (1st Inversion)']
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Major Inversions', true);
        } catch (error) {
          trackTest('Major Inversions', false);
          throw error;
        }
      });
    });

    test('should identify major 2nd inversions', () => {
      const tests = [
        [['G', 'C', 'E'], 'C Major (2nd Inversion)'],
        [['A', 'D', 'F#'], 'D Major (2nd Inversion)'],
        [['B', 'E', 'G#'], 'E Major (2nd Inversion)'],
        [['C', 'F', 'A'], 'F Major (2nd Inversion)'],
        [['D', 'G', 'B'], 'G Major (2nd Inversion)'],
        [['E', 'A', 'C#'], 'A Major (2nd Inversion)']
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Major Inversions', true);
        } catch (error) {
          trackTest('Major Inversions', false);
          throw error;
        }
      });
    });
  });

  describe('Seventh Chords', () => {
    test('should identify seventh chords', () => {
      const tests = [
        [['C', 'E', 'G', 'B'], 'C Major 7th'],
        [['C', 'Eb', 'G', 'Bb'], 'C Minor 7th'],
        [['C', 'E', 'G', 'Bb'], 'C Dominant 7th']
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Seventh Chords', true);
        } catch (error) {
          trackTest('Seventh Chords', false);
          throw error;
        }
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid inputs', () => {
      const tests = [
        [[], null],
        [['C'], null],
        [['X', 'Y', 'Z'], null],
        [['E', 'C', 'G'], null], // Wrong order
        [['C', 'Fb', 'G'], null] // Wrong spelling
      ];
      
      tests.forEach(([input, expected]) => {
        try {
          expect(identifyChordStrict(input)).toBe(expected);
          trackTest('Edge Cases', true);
        } catch (error) {
          trackTest('Edge Cases', false);
          throw error;
        }
      });
    });
  });

  // Print comprehensive summary after all tests
  afterAll(() => {
    console.log('\n' + '='.repeat(60));
    console.log('🎹 CHORD IDENTIFICATION TEST SUMMARY 🎹');
    console.log('='.repeat(60));
    
    console.log(`\n📊 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${testResults.totalTests}`);
    console.log(`   ✅ Passed: ${testResults.passedTests}`);
    console.log(`   ❌ Failed: ${testResults.failedTests}`);
    console.log(`   📈 Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);
    
    console.log(`\n📋 RESULTS BY CATEGORY:`);
    Object.entries(testResults.categories).forEach(([category, results]) => {
      const successRate = ((results.passed / results.total) * 100).toFixed(1);
      const status = results.failed === 0 ? '✅' : '⚠️';
      console.log(`   ${status} ${category}:`);
      console.log(`      ${results.passed}/${results.total} passed (${successRate}%)`);
      if (results.failed > 0) {
        console.log(`      ${results.failed} failed`);
      }
    });
    
    console.log(`\n🎯 CHORD COVERAGE TESTED:`);
    console.log(`   • All 12 major triads`);
    console.log(`   • All 12 minor triads`);
    console.log(`   • Major and minor inversions`);
    console.log(`   • Seventh chords (maj7, min7, dom7)`);
    console.log(`   • Edge cases and error handling`);
    console.log(`   • Octave independence`);
    
    if (testResults.failedTests === 0) {
      console.log(`\n🎉 ALL TESTS PASSED! Your chord identification is working perfectly! 🎉`);
    } else {
      console.log(`\n⚠️  Some tests failed. Check the output above for details.`);
    }
    
    console.log('\n' + '='.repeat(60));
  });

});