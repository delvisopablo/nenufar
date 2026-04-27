export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export class TrieNode {
  readonly children = new Map<string, TrieNode>();
  readonly ids: number[] = [];
}

export class TrieIndex {
  private readonly root = new TrieNode();

  insert(key: string, id: number): void {
    const normalized = normalizeSearchText(key);
    if (!normalized) {
      return;
    }

    let node = this.root;
    for (const char of normalized) {
      let nextNode = node.children.get(char);

      if (!nextNode) {
        nextNode = new TrieNode();
        node.children.set(char, nextNode);
      }

      if (!nextNode.ids.includes(id)) {
        nextNode.ids.push(id);
      }

      node = nextNode;
    }
  }

  remove(key: string, id: number): void {
    const normalized = normalizeSearchText(key);
    if (!normalized) {
      return;
    }

    let node = this.root;
    for (const char of normalized) {
      const nextNode = node.children.get(char);
      if (!nextNode) {
        return;
      }

      const index = nextNode.ids.indexOf(id);
      if (index >= 0) {
        nextNode.ids.splice(index, 1);
      }

      node = nextNode;
    }
  }

  query(prefix: string, limit = 8): number[] {
    const normalized = normalizeSearchText(prefix);
    if (!normalized) {
      return [];
    }

    let node = this.root;
    for (const char of normalized) {
      const nextNode = node.children.get(char);
      if (!nextNode) {
        return [];
      }

      node = nextNode;
    }

    return node.ids.slice(0, Math.max(0, limit));
  }
}
