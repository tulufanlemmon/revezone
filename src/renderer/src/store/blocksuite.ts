import { Workspace, createIndexeddbStorage, createMemoryStorage } from '@revesuite/store';
import { AffineSchemas } from '@revesuite/blocks/models';
import { IndexeddbPersistence } from 'y-indexeddb';
import { emitter, events } from './eventemitter';

console.log('AffineSchemas', AffineSchemas);

const REVEZONE_EDITOR_KEY = 'revezone_blocksuite';

class BlocksuiteStorage {
  constructor() {
    if (BlocksuiteStorage.instance) {
      return BlocksuiteStorage.instance;
    }
    BlocksuiteStorage.instance = this;

    this.initYIndexeddb();
  }

  static instance: BlocksuiteStorage;
  workspace: Workspace = new Workspace({
    id: REVEZONE_EDITOR_KEY,
    blobStorages: [createIndexeddbStorage, createMemoryStorage]
  }).register(AffineSchemas);
  indexeddbPersistence: IndexeddbPersistence | undefined;

  async initYIndexeddb() {
    const indexeddbPersistence = new IndexeddbPersistence(REVEZONE_EDITOR_KEY, this.workspace.doc);

    this.indexeddbPersistence = indexeddbPersistence;

    // @ts-ignore
    window.persistence = indexeddbPersistence;

    indexeddbPersistence.on('synced', async () => {
      console.log('content from the database is loaded');
      emitter.emit(events.WORKSPACE_LOADED);

      this.workspace.slots.pagesUpdated.on((...args) => {
        console.log('--- pagesUpdated ---', ...args);
      });
    });
  }

  async addPage(pageId: string) {
    return await this.workspace.createPage({ id: pageId, init: true });
  }

  async deletePage(pageId: string) {
    try {
      await this.workspace.removePage(pageId);
    } catch (err) {
      console.warn('delete page error: ', err);
    }
  }

  async getAllPageIds(): Promise<string[]> {
    const pageNameList = await this.workspace.getPageNameList();
    const pageIds: string[] = pageNameList.map((name) => name.split('space:')?.[1]);
    console.log('--- getAllPages ---', pageIds);
    return pageIds;
  }

  // TODO: FIGURE OUT THE API OF COPY PAGE IN BLOCKSUITE
  async copyPage(pageId: string, copyPageId: string, title: string) {
    // const copyPage = await this.workspace.getPage(copyPageId);
    // const newPage = await this.workspace.createPage({
    //   id: pageId,
    //   init: { title }
    // });
  }
}

export const blocksuiteStorage = new BlocksuiteStorage();
