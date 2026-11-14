import {defineConfig} from '@playwright/test';
const python=process.platform==='win32'?'.venv\\Scripts\\python.exe':'.venv/bin/python';
const apiPort=Number(process.env.PRINT_ASSIST_API_PORT??8000);
const webPort=Number(process.env.PRINT_ASSIST_WEB_PORT??5173);
export default defineConfig({
  testDir:'tests/e2e', workers:1, retries:0,
  outputDir:`.tools/browser-results-${Date.now()}`,
  use:{baseURL:`http://127.0.0.1:${webPort}`,trace:'retain-on-failure'},
  webServer:[
    {command:`"${python}" -m uvicorn print_assist.api:create_app --factory --app-dir backend --host 127.0.0.1 --port ${apiPort}`,
      url:`http://127.0.0.1:${apiPort}/api/health`,reuseExistingServer:false,
      env:{PRINT_ASSIST_API_PORT:String(apiPort),PRINT_ASSIST_DB:`.tools/e2e-${Date.now()}.sqlite3`}},
    {command:'npm run dev',url:`http://127.0.0.1:${webPort}`,reuseExistingServer:false},
  ],
});
