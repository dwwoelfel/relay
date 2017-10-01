/**
 * @providesModule writeReasonRelayGeneratedFile
 * @flow
 * @format
 */

'use strict';

const crypto = require('crypto');
const invariant = require('invariant');

import type {CodegenDirectory} from '../graphql-compiler/GraphQLCompilerPublic';
// TODO T21875029 ../../relay-runtime/util/RelayConcreteNode
import type {GeneratedNode} from 'RelayConcreteNode';

/**
 * Generate a module for the given document name/text.
 */
async function writeReasonRelayGeneratedFile(
  codegenDir: CodegenDirectory,
  generatedNode: GeneratedNode,
  reasonText: string,
  platform: ?string,
): Promise<?GeneratedNode> {
  const moduleName = generatedNode.name + 'Types';
  const platformName = platform ? moduleName + '.' + platform : moduleName;
  const filename = lowercaseFirst(platformName) + '.re';

  let hash = null;
  if (generatedNode.kind === 'Batch') {
    const oldContent = codegenDir.read(filename);
    // Hash the concrete node including the query text.
    const hasher = crypto.createHash('md5');
    hasher.update('cache-breaker-2');
    hasher.update(JSON.stringify(generatedNode));
    hasher.update(reasonText);
    hash = hasher.digest('hex');
    if (hash === extractHash(oldContent)) {
      codegenDir.markUnchanged(filename);
      return null;
    }
    if (codegenDir.onlyValidate) {
      codegenDir.markUpdated(filename);
      return null;
    }
  }

  const moduleText = formatModule(reasonText, hash);

  codegenDir.writeFile(filename, moduleText);
  return generatedNode;
}

function formatModule(reasonText: string, hash: string) {
  return `/* @relayHash ${hash} */\n\n${reasonText}`;
}

function extractHash(text: ?string): ?string {
  if (!text) {
    return null;
  }
  if (/<<<<<|>>>>>/.test(text)) {
    // looks like a merge conflict
    return null;
  }
  const match = text.match(/@relayHash (\w{32})\b/m);
  return match && match[1];
}

function lowercaseFirst(s: string): string {
  invariant(s.length > 0, 'empty string passed to lowercaseFirst');
  return s[0].toLowerCase() + s.substr(1);
}

module.exports = writeReasonRelayGeneratedFile;
