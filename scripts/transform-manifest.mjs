export const transformManifest = (content, env) => {
  const manifest = JSON.parse(content.toString());

  if (env.WEBPACK_WATCH) {
    manifest.name = `${manifest.name} (Development)`;
  }

  if (env.firefox) {
    delete manifest.minimum_chrome_version;

    Object.assign(manifest, {
      background: {
        scripts: [manifest.background.service_worker],
      },
      browser_specific_settings: {
        gecko: {
          id: 'jiten-reader@jiten.moe',
          strict_min_version: '126.0',
        },
      },
    });
  }

  return JSON.stringify(manifest, null, 2);
};
