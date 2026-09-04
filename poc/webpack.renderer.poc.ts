import configuration from '../.erb/configs/webpack.config.renderer.dev';

// The stock development server also starts Electron via electronmon. The POC
// launches Electron through Playwright instead, so keep only the renderer
// server and avoid a competing app instance taking the single-instance lock.
if (configuration.devServer) {
  delete configuration.devServer.setupMiddlewares;
}

export default configuration;

