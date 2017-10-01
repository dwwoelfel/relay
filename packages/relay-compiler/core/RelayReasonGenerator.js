/**
 * @providesModule RelayReasonGenerator
 * @flow
 * @format
 */

'use strict';

const ReasonablyTyped = require('reasonably-typed');
const RelayFlowGenerator = require('./RelayFlowGenerator');

import type {Fragment, Root} from '../graphql-compiler/GraphQLCompilerPublic';
import type {ScalarTypeMapping} from './RelayFlowTypeTransformers';

function generateTypes(
  node: Root | Fragment,
  customScalars?: ?ScalarTypeMapping,
  inputFieldWhiteList?: ?Array<string>
): string {
  const flowTypeDef = RelayFlowGenerator.generate(
    node,
    customScalars,
    inputFieldWhiteList
  );
  const reasonablyTypedCompatDef = flowTypeDef
    .replace(/export type/g, 'type')
    .replace(/\$ReadOnlyArray/g, 'Array');
  return ReasonablyTyped.compile(reasonablyTypedCompatDef).replace(/\.\./g, '.');
}

module.exports = {generateTypes};
