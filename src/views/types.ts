export interface View {
  mount(container: HTMLElement): void | Promise<void>;
  unmount(): void;
  update?(fullRedraw?: boolean): void;
}
