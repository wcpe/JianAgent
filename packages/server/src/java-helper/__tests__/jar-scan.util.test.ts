import { describe, expect, it } from 'vitest';
import { parseManifestText } from '../jar-scan.util.js';

describe('parseManifestText', () => {
  it('parses Main-Class and continuation lines', () => {
    const manifest = [
      'Manifest-Version: 1.0',
      'Main-Class: com.example.bootstrap.Main',
      'Implementation-Title: JianAgent',
      'Long-Attr: part-one',
      ' part-two',
      '',
    ].join('\n');

    expect(parseManifestText(manifest)).toEqual({
      'Manifest-Version': '1.0',
      'Main-Class': 'com.example.bootstrap.Main',
      'Implementation-Title': 'JianAgent',
      'Long-Attr': 'part-onepart-two',
    });
  });
});