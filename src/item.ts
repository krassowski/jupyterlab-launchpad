// Copyright (c) Nebari Development Team.
// Distributed under the terms of the Modified BSD License.
import type { CommandRegistry } from '@lumino/commands';
import type { VirtualElement } from '@lumino/virtualdom';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ILauncher } from '@jupyterlab/launcher';
import { Signal, ISignal } from '@lumino/signaling';
import { IItem, IFavoritesDatabase, ILastUsedDatabase } from './types';

export class Item implements IItem {
  // base ILauncher.IItemOptions
  command: string;
  args?: ReadonlyJSONObject;
  category?: string;
  rank?: number;
  kernelIconUrl?: string;
  metadata?: ReadonlyJSONObject;
  // custom additions
  label: string;
  caption: string;
  icon: VirtualElement.IRenderer | undefined;
  iconClass: string;
  starred: boolean;

  constructor(
    private _options: {
      commands: CommandRegistry;
      item: ILauncher.IItemOptions;
      cwd: string;
      lastUsedDatabase: ILastUsedDatabase;
      favoritesDatabase: IFavoritesDatabase;
    }
  ) {
    const { item, commands, lastUsedDatabase, favoritesDatabase, cwd } =
      _options;
    const args = { ...item.args, cwd };
    // base
    this.command = item.command;
    this.args = args;
    this.category = item.category;
    this.rank = item.rank;
    this.kernelIconUrl = item.kernelIconUrl;
    this.metadata = item.metadata;
    // custom
    this.iconClass = commands.iconClass(item.command, args);
    this.icon = commands.icon(item.command, args);
    this.caption = commands.caption(item.command, args);
    this.label = commands.label(item.command, args);
    this.lastUsed = lastUsedDatabase.get(item);
    this.starred = favoritesDatabase.get(item) ?? false;
  }
  get lastUsed(): Date | null {
    return this._lastUsed;
  }
  set lastUsed(value: Date | null) {
    this._lastUsed = value;
    this._setRefreshClock();
  }
  get refreshLastUsed(): ISignal<IItem, void> {
    return this._refreshLastUsed;
  }
  async execute() {
    const { item, commands, lastUsedDatabase } = this._options;
    await commands.execute(item.command, this.args);
    await lastUsedDatabase.recordAsUsedNow(item);
    this.lastUsed = lastUsedDatabase.get(item);
    this._refreshLastUsed.emit();
  }
  async markAsUsed() {
    const { item, lastUsedDatabase } = this._options;
    await lastUsedDatabase.recordAsUsedNow(item);
    this.lastUsed = lastUsedDatabase.get(item);
    this._refreshLastUsed.emit();
  }
  toggleStar() {
    const { item, favoritesDatabase } = this._options;
    const wasStarred = favoritesDatabase.get(item);
    const newState = !wasStarred;
    this.starred = newState;
    return favoritesDatabase.set(item, newState);
  }
  private _setRefreshClock() {
    const value = this._lastUsed;
    if (this._refreshClock !== null) {
      window.clearTimeout(this._refreshClock);
      this._refreshClock = null;
    }
    if (!value) {
      return;
    }
    const delta = Date.now() - value.getTime();
    // Refresh every 10 seconds if last used less than a minute ago;
    // Otherwise refresh every 1 minute if last used less than 1 hour ago
    // Otherwise refresh every 1 hour.
    const second = 1000;
    const minute = 60 * second;
    const interval =
      delta < 1 * minute
        ? 10 * second
        : delta < 60 * minute
          ? 1 * minute
          : 60 * minute;
    this._refreshClock = window.setTimeout(() => {
      this._refreshLastUsed.emit();
      this._setRefreshClock();
    }, interval);
  }
  private _refreshLastUsed = new Signal<Item, void>(this);
  private _refreshClock: number | null = null;
  private _lastUsed: Date | null = null;
}