import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { SEED_FILE, Seed, signIn, viewer } from './backend';
import { prepare, snap } from './stable-page';

const readSeed = (): Seed => JSON.parse(readFileSync(SEED_FILE, 'utf8'));

const shown = (page: Page, text: string) =>
  expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();

const tap = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true }).last().click();

const visit = async (page: Page, path: string, readyText: string, name: string) => {
  await page.goto(path);
  await shown(page, readyText);
  await snap(page, name);
};

test('signed-out screens', async ({ page }) => {
  await prepare(page, readSeed().time);

  await visit(page, '/', 'Join or sign in', 'signed-out-search');

  await tap(page, 'Join or sign in');
  await shown(page, 'Use email');
  await snap(page, 'join-or-sign-in');

  await visit(page, '/email', 'Continue with email', 'email');
  await visit(page, '/invite/snapshot%20club', 'Accept Invite', 'invite');
});

for (const theme of ['light', 'dark']) {
  test(`signed-in screens in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(240_000);

    const seed = readSeed();
    const session = await signIn(viewer.email);
    const seen = JSON.stringify([session.uuid]);
    const blake = seed.uuids.blake;

    await prepare(page, seed.time + 2 * 60 * 60 * 1000, {
      session_token: session.token,
      person_uuid: session.uuid,
      app_theme_name: theme,
      web_session_bridge_answered: '1',
      seen_search_filters_hint: seen,
      seen_inbox_filter_hint: seen,
      seen_reply_hint: seen,
    });

    await visit(page, '/qa', 'Answer Publicly', `${theme}-qa`);
    await visit(page, '/search', 'Blake, 26', `${theme}-search`);
    await visit(page, '/search/filters', 'Other Basics', `${theme}-search-filters`);
    await visit(page, '/search/filters/qa', 'added any Q&A filters', `${theme}-qa-filters`);
    await visit(page, '/search/filters/two-way', 'Making a filter two-way', `${theme}-two-way-filters`);

    await expect(async () => {
      await page.goto('/feed');
      for (const name of ['Cameron', 'Blake', 'Dakota']) {
        await expect(page.getByText(name, { exact: true }).first()).toBeAttached();
      }
    }).toPass({ timeout: 120_000 });
    await snap(page, `${theme}-feed`);

    await visit(page, '/inbox', 'I saw you like hiking', `${theme}-inbox-intros`);
    await tap(page, 'Chats');
    await shown(page, 'Definitely sourdough');
    await snap(page, `${theme}-inbox-chats`);

    await visit(page, `/chat/${seed.uuids.emery}`, 'Definitely sourdough', `${theme}-conversation`);

    await visit(page, '/visitors', 'Dakota', `${theme}-visitors`);
    await tap(page, 'You Visited');
    await shown(page, 'Blake');
    await snap(page, `${theme}-you-visited`);

    await visit(page, `/${blake}`, 'Engineer', `${theme}-prospect-profile`);
    await page.locator('a[href^="/gallery/"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/gallery\//);
    await snap(page, `${theme}-gallery`);

    await visit(page, `/in-depth/${blake}`, 'Q&A Answers', `${theme}-in-depth`);
    await tap(page, 'Personality');
    await snap(page, `${theme}-in-depth-personality`);

    await visit(page, '/profile', 'Verification', `${theme}-profile`);
  });
}
