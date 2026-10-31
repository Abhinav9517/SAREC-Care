import process from 'node:process';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const screenshotDir = path.resolve(process.cwd(), '..', 'qa-screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const viewports = [
  { width: 375, height: 812 }, { width: 390, height: 844 },
  { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 },
]

for (const viewport of viewports) {
  test(`landing page layout ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = []
    const networkFailures = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('requestfailed', (request) => networkFailures.push(`${request.url()}: ${request.failure()?.errorText}`))
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Your Campus\. Your Voice\. Our Responsibility\./ })).toBeVisible()
    await expect(page.locator('img[alt="SAREC Care logo"]').first()).toBeVisible()
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/sarec-care-logo.jpg')
    expect(await page.locator('img[alt="SAREC Care logo"]').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await expect(page.getByRole('link', { name: /Log in/ }).first()).toBeVisible()
    if ([375, 1366].includes(viewport.width)) await page.screenshot({ path: path.join(screenshotDir, `landing-${viewport.width}.png`), fullPage: true })
    expect(errors).toEqual([])
    expect(networkFailures).toEqual([])
  })
}

test('login and registration forms render and validate without API credentials', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible()
  await page.screenshot({ path: path.join(screenshotDir, 'login-desktop.png'), fullPage: true })
  await expect(page.getByRole('link', { name: 'Forgot Password?' })).toHaveAttribute('href', '/forgot-password')
  await page.getByRole('tab', { name: 'Register' }).click()
  await expect(page.getByRole('heading', { name: 'Create your student account' })).toBeVisible()
  await page.screenshot({ path: path.join(screenshotDir, 'registration-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: /Create student account/ }).click()
  await expect(page.getByText('Please enter your full name.')).toBeVisible()
})

test('protected dashboard routes require a real session', async ({ page }) => {
  for (const route of ['/student', '/admin', '/resolver']) {
    await page.goto(route)
    await expect(page).toHaveURL('/')
  }
})
