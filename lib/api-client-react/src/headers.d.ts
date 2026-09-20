// React Native's fetch Headers implementation supports entries() at runtime,
// but the workspace's Node fetch typings do not expose that DOM iterable method.
interface Headers {
  entries(): IterableIterator<[string, string]>;
}