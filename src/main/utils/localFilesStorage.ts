import fs from 'node:fs';
import { ensureDir } from './io';
import { getUserFilesStoragePath } from './customStoragePath';
import {
  RevezoneFileTree,
  RevezoneFolder,
  RevezoneFile,
  RevezoneFileType
} from '../../renderer/src/types/file';
import path, { join } from 'node:path';
import { TreeItem } from 'react-complex-tree';

interface FullPathInfo {
  type: 'folder' | 'file';
  fileType?: RevezoneFileType;
  suffix?: '.excalidraw' | '.md';
  path: string;
  parentDirPath: string;
}

/**
 * ATTENTION: Files's name cannot be same in one directory
 * @param fileId
 * @param fileTree
 * @param filePath
 */
export const getParentPathInFileTree = (
  itemId: string,
  fileTree: RevezoneFileTree,
  filePath = ''
) => {
  let parentItem;

  const items = Object.values(fileTree);

  items.forEach((treeItem: TreeItem) => {
    if (treeItem.children?.includes(itemId)) {
      parentItem = treeItem.data;
    }
  });

  if (parentItem) {
    // @ts-ignore
    filePath = getParentPathInFileTree(parentItem.id, fileTree, `${parentItem.name}/${filePath}`);
  }

  return filePath;
};

export function getFullPathInfo(itemId: string, fileTree: RevezoneFileTree): FullPathInfo {
  const item = fileTree[itemId].data;

  const userFilesStoragePath = getUserFilesStoragePath();

  const parentPathInFileTree = getParentPathInFileTree(itemId, fileTree);

  console.log('--- parentPathInFileTree ---', parentPathInFileTree);

  const parentDirPath = join(userFilesStoragePath, parentPathInFileTree);

  if (item.type === 'folder') {
    const folderFullPath = path.join(parentDirPath, item.name);

    return {
      type: 'folder',
      path: folderFullPath,
      parentDirPath
    };
  } else {
    const suffix = item.type === 'board' ? '.excalidraw' : '.md';
    const fullFilePath = path.join(parentDirPath, `${item.name}${suffix}`);

    return {
      type: 'file',
      fileType: item.type,
      suffix,
      path: fullFilePath,
      parentDirPath
    };
  }
}

export function addOrUpdateFile(
  fileId: string,
  value: string,
  fileTree: RevezoneFileTree,
  type: 'add' | 'update'
) {
  const { path: fullFilePath, parentDirPath } = getFullPathInfo(fileId, fileTree);

  console.log('--- addOrUpdateFile ---', fullFilePath, type);

  if (type === 'update' && !fs.existsSync(fullFilePath)) {
    return;
  }

  ensureDir(parentDirPath);

  fs.writeFileSync(fullFilePath, value);
}

export function onAddFile(fileId: string, value: string, fileTree: RevezoneFileTree) {
  console.log('--- onAddFile ---', fileId, value, fileTree);
  addOrUpdateFile(fileId, value, fileTree, 'add');
}

export function onFileDataChange(fileId: string, value: string, fileTree: RevezoneFileTree) {
  addOrUpdateFile(fileId, value, fileTree, 'update');
}

export function onRenameFileOrFolder(itemId: string, newName: string, fileTree: RevezoneFileTree) {
  console.log('--- rename ---', itemId, newName, fileTree);

  const { path: fullFilePath, parentDirPath, suffix } = getFullPathInfo(itemId, fileTree);

  fs.renameSync(fullFilePath, `${parentDirPath}/${newName}${suffix}`);
}

export function onDeleteFileOrFolder(
  item: RevezoneFile | RevezoneFolder,
  fileTree: RevezoneFileTree
) {
  console.log('--- delete ---', item, fileTree);

  const { path: fullFilePath } = getFullPathInfo(item.id, fileTree);

  if (item.type === 'folder') {
    fs.rmdirSync(fullFilePath);
  } else {
    console.log('--- delete file path ---', fullFilePath);

    fs.rmSync(fullFilePath);
  }
}
