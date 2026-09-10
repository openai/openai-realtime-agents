import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',use:{baseURL:'http://127.0.0.1:3210',browserName:'chromium',viewport:{width:390,height:844}},workers:1});
