/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * All rights reserved.
 *
 * @providesModule RelayMaskTransform
 * @flow
 * @format
 */

'use strict';

const GraphQLCompilerContext = require('../core/GraphQLCompilerContext');
const GraphQLIRTransformer = require('../core/GraphQLIRTransformer');

const getLiteralArgumentValues = require('../core/getLiteralArgumentValues');
const invariant = require('invariant');
const stableJSONStringify = require('stableJSONStringify');

import type {
  Fragment,
  FragmentSpread,
  InlineFragment,
  Node,
  ArgumentDefinition,
} from '../core/GraphQLIR';

type State = {
  hoistedArgDefs: Map<
    string /* argument name */,
    {
      argDef: ArgumentDefinition,
      source: string /* fragment spread name */,
    },
  >,
};

/**
 * A transform that inlines fragment spreads with the @relay(mask: false)
 * directive.
 */
function relayMaskTransform(
  context: GraphQLCompilerContext,
): GraphQLCompilerContext {
  return GraphQLIRTransformer.transform(
    context,
    {
      FragmentSpread: visitFragmentSpread,
      Fragment: visitFragment,
    },
    () => ({
      hoistedArgDefs: new Map(),
    }),
  );
}

function visitFragment(fragment: Fragment, state: State): Fragment {
  const result = this.traverse(fragment, state);
  const existingArgDefs = new Map(
    result.argumentDefinitions.map(entry => [entry.name, entry]),
  );
  const combinedArgDefs = [...result.argumentDefinitions];
  state.hoistedArgDefs.forEach((hoistedArgDef, argName) => {
    const existingArgDef = existingArgDefs.get(argName);
    if (existingArgDef) {
      invariant(
        areSameArgumentDefinitions(existingArgDef, hoistedArgDef.argDef),
        'RelayMaskTransform: Cannot unmask fragment spread `%s` because ' +
          'argument `%s` has been declared in `%s` and they are not the same.',
        hoistedArgDef.source,
        argName,
        fragment.name,
      );
      return;
    }
    combinedArgDefs.push(hoistedArgDef.argDef);
  });
  return {
    ...result,
    argumentDefinitions: combinedArgDefs,
  };
}

function visitFragmentSpread(
  fragmentSpread: FragmentSpread,
  state: State,
): FragmentSpread {
  if (!hasRelayMaskFalseDirective(fragmentSpread)) {
    return fragmentSpread;
  }
  invariant(
    fragmentSpread.args.length === 0,
    'RelayMaskTransform: Cannot unmask fragment spread `%s` with ' +
      'arguments. Use the `ApplyFragmentArgumentTransform` before flattening',
    fragmentSpread.name,
  );
  const fragment: ?Node = this.getContext().get(fragmentSpread.name);
  invariant(
    fragment && fragment.kind === 'Fragment',
    'RelayMaskTransform: Unknown fragment `%s`.',
    fragmentSpread.name,
  );
  const result: InlineFragment = {
    kind: 'InlineFragment',
    directives: fragmentSpread.directives,
    metadata: fragmentSpread.metadata,
    selections: fragment.selections,
    typeCondition: fragment.type,
  };

  invariant(
    !fragment.argumentDefinitions.find(
      argDef => argDef.kind === 'LocalArgumentDefinition',
    ),
    'RelayMaskTransform: Cannot unmask fragment spread `%s` because it has local ' +
      'argument definition.',
    fragmentSpread.name,
  );

  for (const argDef of fragment.argumentDefinitions) {
    const hoistedArgDef = state.hoistedArgDefs.get(argDef.name);
    if (hoistedArgDef) {
      invariant(
        areSameArgumentDefinitions(argDef, hoistedArgDef.argDef),
        'RelayMaskTransform: Cannot unmask fragment spread `%s` because ' +
          'argument `%s` has been declared in `%s` and they are not the same.',
        hoistedArgDef.source,
        argDef.name,
        fragmentSpread.name,
      );
      continue;
    }
    state.hoistedArgDefs.set(argDef.name, {
      argDef,
      source: fragmentSpread.name,
    });
  }
  return this.traverse(result, state);
}

function hasRelayMaskFalseDirective(fragmentSpread: FragmentSpread): boolean {
  const relayDirective = fragmentSpread.directives.find(
    ({name}) => name === 'relay',
  );
  if (!relayDirective) {
    return false;
  }
  const {mask} = getLiteralArgumentValues(relayDirective.args);
  return mask === false;
}

function areSameArgumentDefinitions(
  argDef1: ArgumentDefinition,
  argDef2: ArgumentDefinition,
) {
  return stableJSONStringify(argDef1) === stableJSONStringify(argDef2);
}

module.exports = {
  transform: relayMaskTransform,
};
