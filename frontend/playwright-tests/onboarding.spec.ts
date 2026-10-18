import { test, expect, Page } from '@playwright/test';

const visibleText = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true }).last();

const tap = (page: Page, text: string) => visibleText(page, text).click();

const leave = (page: Page, title: string) =>
  expect(page.getByText(title, { exact: true })).toBeHidden();

const signUp = async (page: Page) => {
  await tap(page, 'Use email');
  await leave(page, 'Use email');
  await page.getByPlaceholder('you@example.com').fill(`${Date.now()}@example.com`);
  await tap(page, 'Continue');

  await page.locator('input[inputmode="numeric"]').first().fill('000000');
  await leave(page, 'Password');

  await page.getByPlaceholder('First name').fill('Test');
  await tap(page, 'Continue');
  await leave(page, 'Step 1 of 5: Display Name');

  await tap(page, 'Woman');
  await tap(page, 'Continue');
  await leave(page, 'Step 2 of 5: Your Gender');

  await tap(page, 'Man');
  await tap(page, 'Continue');
  await leave(page, 'Step 3 of 5: Your Partner’s Gender');

  await tap(page, 'Day');
  await tap(page, '1');
  await tap(page, 'Month');
  await tap(page, 'Jan');
  await tap(page, 'Year');
  await tap(page, '2000');
  await tap(page, 'Continue');
  await tap(page, 'Yes, I’m 26');
  await leave(page, 'Step 4 of 5: Birth Date');

  await tap(page, 'Manually enter my location');
  await page.getByPlaceholder('Type a location...').fill('Paris');
  await tap(page, 'Paris, Île-de-France, France');
  await tap(page, 'Continue');
  await leave(page, 'Step 5 of 5: Location');

  await tap(page, 'Complete Sign Up');
  await leave(page, 'You’re Looking Like A Snack 😋');
};

test('new users can sign up', async ({ page }) => {
  await page.goto('/');
  await tap(page, 'Join or sign in');
  await signUp(page);

  await tap(page, 'Profile');
  await expect(page.getByText('Test', { exact: true })).toBeVisible();
});

test('new users can accept club invites', async ({ page }) => {
  const clubName = `invite ${Date.now()}`;

  await page.goto(`/invite/${encodeURIComponent(clubName)}`);
  await tap(page, 'Accept Invite');
  await signUp(page);

  await expect(visibleText(page, 'Everyone')).toBeVisible();
  await expect(visibleText(page, clubName)).toBeVisible();
});
