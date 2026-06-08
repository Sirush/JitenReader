export const matchUrl = (matchPattern: string, host: string): boolean => {
  if (matchPattern === '<all_urls>') {
    return true;
  }

  const parts = matchPattern.split('://', 2);

  if (parts.length < 2) {
    return false;
  }

  let patternSchema = parts[0];
  const patternUrl = parts[1];

  const [patternHost, patternPath] = patternUrl.split(/\/(.*)/, 2);
  const [hostSchema, hostUrl] = host.split('://', 2);
  const [hostHost, hostPath] = hostUrl.split(/\/(.*)/, 2);

  if (patternSchema === '') {
    patternSchema = '*';
  }

  if (patternSchema === '*' && !['http', 'https'].includes(hostSchema)) {
    return false;
  }

  if (patternSchema !== '*' && patternSchema !== hostSchema) {
    return false;
  }

  const hostRegex = new RegExp(`^${patternHost.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
  const pathRegex = new RegExp(`^${patternPath.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);

  if (!hostHost.match(hostRegex)) {
    return false;
  }

  if (!hostPath.match(pathRegex)) {
    return false;
  }

  return true;
};
