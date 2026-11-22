import invariant from 'tiny-invariant';

const drivePathPattern = /^(?<drive>[A-Za-z]):\\?(?<rest>.*)$/u;

// The drive letter becomes a folder of the mount root, which is /mnt in WSL.
export function toWSLPath(windowsPath: string, mountRoot: string): string {
  const groups = drivePathPattern.exec(windowsPath)?.groups;

  invariant(groups !== undefined, `not an absolute Windows path: ${windowsPath}`);

  const drive = `${mountRoot}/${(groups['drive'] ?? '').toLowerCase()}`;
  const tail = (groups['rest'] ?? '').replaceAll('\\', '/');

  return tail === '' ? drive : `${drive}/${tail}`;
}
