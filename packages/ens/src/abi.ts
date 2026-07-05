/**
 * Minimal ABIs for our deployed registrars. Hand-written so we don't pull
 * forge build artifacts into the runtime — only the call signatures we need.
 */
export const subnameRegistrarAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'owner_', type: 'address' },
    ],
    outputs: [{ name: 'node', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'setTextRecords',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'keys', type: 'string[]' },
      { name: 'values', type: 'string[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'ownerOfLabel',
    stateMutability: 'view',
    inputs: [{ name: 'labelHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'SubnameRegistered',
    inputs: [
      { name: 'labelHash', type: 'bytes32', indexed: true },
      { name: 'label', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const;

export const accessTokenRegistrarAbi = [
  {
    type: 'function',
    name: 'issue',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'agent', type: 'address' },
      { name: 'brainNameHash', type: 'bytes32' },
      { name: 'ttlSeconds', type: 'uint64' },
    ],
    outputs: [{ name: 'node', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'consume',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [
      {
        name: 't',
        type: 'tuple',
        components: [
          { name: 'agent', type: 'address' },
          { name: 'brainNameHash', type: 'bytes32' },
          { name: 'expiresAt', type: 'uint64' },
          { name: 'consumed', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isValid',
    stateMutability: 'view',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'agent', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
