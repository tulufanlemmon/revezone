import {
  ControlledTreeEnvironment,
  Tree,
  TreeItem,
  TreeItemIndex,
  DraggingPosition,
  DraggingPositionBetweenItems,
  DraggingPositionItem
} from 'react-complex-tree';
import { useCallback, useEffect } from 'react';
import { Dropdown } from 'antd';
import { fileTreeIndexeddbStorage } from '@renderer/store/fileTreeIndexeddb';
import type { RevezoneFile, RevezoneFolder } from '@renderer/types/file';
import { useAtom } from 'jotai';
import { focusItemAtom, selectedKeysAtom } from '@renderer/store/jotai';
import { blocksuiteStorage } from '@renderer/store/blocksuite';
import OperationBar from '../OperationBar';
import RevezoneLogo from '../RevezoneLogo';
import { Folder, HardDrive, UploadCloud, MoreVertical, Palette, FileType } from 'lucide-react';
import useFileTreeContextMenu from '@renderer/hooks/useFileTreeContextMenu';
import useFileTree from '@renderer/hooks/useFileTree';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher/index';
import { boardIndexeddbStorage } from '@renderer/store/boardIndexeddb';
import { submitUserEvent } from '@renderer/utils/statistics';
import PublicBetaNotice from '@renderer/components/PublicBetaNotice';
import useTabList from '@renderer/hooks/useTabList';
import useCurrentFile from '@renderer/hooks/useCurrentFile';
import useOpenKeys from '@renderer/hooks/useOpenKeys';
import { setRenamingMenuItemIdToLocal } from '@renderer/store/localstorage';
import moment from 'moment';

import 'react-complex-tree/lib/style-modern.css';
import './index.css';

export default function DraggableMenuTree() {
  const [selectedKeys, setSelectedKeys] = useAtom(selectedKeysAtom);
  const [focusItem, setFocusItem] = useAtom(focusItemAtom);
  const { fileTree, getFileTree } = useFileTree();
  const { openKeys, addOpenKey, removeOpenKey } = useOpenKeys();
  const { t } = useTranslation();

  const { updateTabListWhenCurrentFileChanged, renameTabName, tabList } = useTabList();
  const { currentFile, updateCurrentFile } = useCurrentFile();

  useEffect(() => {
    getFileTree();
  }, []);

  const deleteFile = useCallback(
    async (file: RevezoneFile) => {
      await fileTreeIndexeddbStorage.deleteFile(file.id);

      console.log('--- delete file ---', file);

      switch (file.type) {
        case 'board':
          await boardIndexeddbStorage.deleteBoard(file.id);
          break;
        case 'note':
          await blocksuiteStorage.deletePage(file.id);
          break;
      }

      if (file.id === currentFile?.id) {
        updateCurrentFile(undefined);
      }

      await getFileTree();
    },
    [fileTreeIndexeddbStorage, currentFile]
  );

  const deleteFolder = useCallback(
    async (folder: RevezoneFolder) => {
      await fileTreeIndexeddbStorage.deleteFolder(folder.id);
      await getFileTree();
    },
    [fileTreeIndexeddbStorage]
  );

  const { getFileTreeContextMenu } = useFileTreeContextMenu({
    deleteFile,
    deleteFolder
  });

  const resetMenu = useCallback(() => {
    updateCurrentFile(undefined);
    setSelectedKeys([]);
  }, []);

  const onExpandItem = useCallback(
    (item: TreeItem) => {
      addOpenKey(item.data.id);
    },
    [openKeys]
  );

  const onCollapseItem = useCallback(
    (item) => {
      removeOpenKey(item.data.id);
    },
    [openKeys]
  );

  const onSelectItems = useCallback(
    async (items) => {
      const key = typeof items?.[0] === 'string' ? items?.[0] : items?.[0].id;

      console.log('onSelect', items);

      const fileId = key?.startsWith('file_') ? key : undefined;

      if (!fileId) return;

      const file = await updateCurrentFile(fileId);

      updateTabListWhenCurrentFileChanged(file, tabList);

      submitUserEvent('select_menu', { key });
    },
    [fileTree, tabList]
  );

  const onFocusItem = useCallback((item: TreeItem) => {
    console.log('--- onFocusItem ---', item);
    setFocusItem(item.data.id);
  }, []);

  const onRenameItem = useCallback(async (item, name) => {
    console.log('--- onRenameItem ---', item, name);
    setRenamingMenuItemIdToLocal('');

    if (item.isFolder) {
      await fileTreeIndexeddbStorage.updateFolderName(item.data, name);
    } else {
      await fileTreeIndexeddbStorage.updateFileName(item.data, name);
      await renameTabName(item.data.id, name, tabList);
    }

    setTimeout(() => {
      getFileTree();
    }, 0);
  }, []);

  const onDropBetweenItems = useCallback(
    async (
      items: TreeItem<RevezoneFile | RevezoneFolder>[],
      target: DraggingPositionBetweenItems
    ) => {
      const itemIds: string[] = items.map((item) => item.data.id);

      let newChildren;

      const children = fileTree[target.parentItem].children;
      newChildren = children?.filter((child) => !itemIds.includes(String(child)));

      newChildren = [
        ...newChildren.slice(0, target.childIndex),
        ...itemIds,
        ...newChildren.slice(target.childIndex)
      ];

      fileTree[target.parentItem].children = newChildren;

      await fileTreeIndexeddbStorage.updateFileTree(fileTree);

      getFileTree();
    },
    []
  );

  const onDropItem = useCallback(
    async (items: TreeItem<RevezoneFile | RevezoneFolder>[], target: DraggingPositionItem) => {},
    []
  );

  const onDrop = useCallback(
    async (items: TreeItem<RevezoneFile | RevezoneFolder>[], target: DraggingPosition) => {
      console.log('--- onDrop ---', items, target);

      switch (target.targetType) {
        case 'between-items':
          onDropBetweenItems(items, target);
          break;
        case 'item':
          onDropItem(items, target);
          break;
        case 'root':
          break;
      }
    },
    [fileTree]
  );

  const storageTypeItems = [
    {
      key: 'local',
      icon: <HardDrive className="w-4 mr-1"></HardDrive>,
      label: t('storage.local')
    },
    {
      key: 'cloud',
      icon: <UploadCloud className="w-4 mr-1"></UploadCloud>,
      disabled: true,
      label: t('storage.cloud')
    }
  ];

  return (
    <div className="revezone-menu-container">
      <div className="flex flex-col mb-1 pl-5 pr-8 pt-0 justify-between">
        <div className="flex items-center">
          <RevezoneLogo size="small" onClick={() => resetMenu()} />
          <span>&nbsp;-&nbsp;{t('text.alpha')}</span>
          <PublicBetaNotice />
        </div>
        <div className="flex justify-start">
          <div className="mr-2 whitespace-nowrap">
            <Dropdown menu={{ items: storageTypeItems }}>
              <span className="text-slate-500 flex items-center cursor-pointer text-sm">
                <HardDrive className="w-4 mr-1"></HardDrive>
                {t('storage.local')}
              </span>
            </Dropdown>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
      <OperationBar size="small" />
      <div className="menu-list border-t border-slate-100 px-1">
        <ControlledTreeEnvironment
          items={fileTree}
          getItemTitle={(item) => `${item.data.name}`}
          viewState={{
            ['revezone-file-tree']: {
              selectedItems: selectedKeys,
              expandedItems: openKeys,
              focusedItem: focusItem
            }
          }}
          canDragAndDrop={true}
          canDropOnFolder={true}
          canReorderItems={true}
          canRename={true}
          canSearch={true}
          onSelectItems={onSelectItems}
          onExpandItem={onExpandItem}
          onCollapseItem={onCollapseItem}
          onFocusItem={onFocusItem}
          onDrop={onDrop}
          onRenameItem={onRenameItem}
          renderTreeContainer={({ children, containerProps }) => (
            <div {...containerProps}>{children}</div>
          )}
          renderItemsContainer={({ children, containerProps }) => (
            <ul {...containerProps}>{children}</ul>
          )}
          renderItem={({ item, depth, children, title, context, arrow }) => {
            const InteractiveComponent = context.isRenaming ? 'div' : 'button';
            const type = context.isRenaming ? undefined : 'button';

            return (
              <li {...context.itemContainerWithChildrenProps} className="rct-tree-item-li">
                <div
                  {...context.itemContainerWithoutChildrenProps}
                  style={{ paddingLeft: `${(depth + 1) * 0.5}rem` }}
                  className={[
                    'rct-tree-item-title-container',
                    item.isFolder && 'rct-tree-item-title-container-isFolder',
                    context.isSelected && 'rct-tree-item-title-container-selected',
                    context.isExpanded && 'rct-tree-item-title-container-expanded',
                    context.isFocused && 'rct-tree-item-title-container-focused',
                    context.isDraggingOver && 'rct-tree-item-title-container-dragging-over',
                    context.isSearchMatching && 'rct-tree-item-title-container-search-match'
                  ].join(' ')}
                  // onClick={(e) => e.stopPropagation()}
                >
                  {arrow}
                  <InteractiveComponent
                    // @ts-ignore
                    type={type}
                    {...context.interactiveElementProps}
                    className="rct-tree-item-button flex justify-between items-center"
                  >
                    <div
                      className={`flex items-center flex-1 menu-tree-item-child ${item.data.id}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        context.startRenamingItem();
                      }}
                      onBlur={() => {
                        console.log('--- onBlur ---');
                        setRenamingMenuItemIdToLocal('');
                        context.stopRenamingItem();
                      }}
                    >
                      <div>
                        {item.isFolder ? <Folder className="w-4 h-4" /> : null}
                        {item.data.type === 'note' ? <FileType className="w-4 h-4" /> : null}
                        {item.data.type === 'board' ? <Palette className="w-4 h-4" /> : null}
                      </div>
                      <div className="flex flex-col ml-2">{title}</div>
                    </div>
                    <Dropdown
                      menu={{
                        items: getFileTreeContextMenu(item.data, context, !!item.isFolder)
                      }}
                    >
                      <MoreVertical
                        className="w-3 h-3 cursor-pointer text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  </InteractiveComponent>
                </div>
                {children}
              </li>
            );
          }}
        >
          <Tree treeId="revezone-file-tree" rootItem="root" treeLabel="FileTree" />
        </ControlledTreeEnvironment>
      </div>
    </div>
  );
}
