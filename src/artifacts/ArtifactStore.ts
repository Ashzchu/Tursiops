export class ArtifactStore {
  private readonly store = new Map<string, string>();

  set(id: string, content: string): void {
    this.store.set(id, content);
  }

  get(id: string): string | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  delete(id: string): void {
    this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
  }
}
