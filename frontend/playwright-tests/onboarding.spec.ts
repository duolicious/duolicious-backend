import { test, expect } from '@playwright/test';

test('new users can sign up', async ({ page }) => {
  const tap = (text: string) =>
    page.getByText(text, { exact: true }).filter({ visible: true }).last().click();

  const leave = (title: string) =>
    expect(page.getByText(title, { exact: true })).toBeHidden();

  await page.goto('/');

  await tap('Join or sign in');
  await tap('Use email');
  await leave('Use email');
  await page.getByPlaceholder('you@example.com').fill(`${Date.now()}@example.com`);
  await tap('Continue');

  await page.locator('input[inputmode="numeric"]').first().fill('000000');
  await leave('Password');

  await page.getByPlaceholder('First name').fill('Test');
  await tap('Continue');
  await leave('Step 1 of 5: Display Name');

  await tap('Woman');
  await tap('Continue');
  await leave('Step 2 of 5: Your Gender');

  await tap('Man');
  await tap('Continue');
  await leave('Step 3 of 5: Your Partner’s Gender');

  await tap('Day');
  await tap('1');
  await tap('Month');
  await tap('Jan');
  await tap('Year');
  await tap('2000');
  await tap('Continue');
  await tap('Yes, I’m 26');
  await leave('Step 4 of 5: Birth Date');

  await tap('Manually enter my location');
  await page.getByPlaceholder('Type a location...').fill('Paris');
  await tap('Paris, Île-de-France, France');
  await tap('Continue');
  await leave('Step 5 of 5: Location');

  await tap('Complete Sign Up');
  await leave('You’re Looking Like A Snack\u00A0😋');

  await tap('Profile');
  await expect(page.getByText('Test', { exact: true })).toBeVisible();
});
