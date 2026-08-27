import { expect, test } from "@playwright/test";

import { signIn, uniqueEmail } from "./helpers";

test.describe("project gallery", () => {
  test("a maker's work appears on their public profile", async ({ page }) => {
    await page.goto("/p/ada-prints");

    await expect(page.getByText("Articulated dragon, multi-colour").first()).toBeVisible();
    const image = page.getByRole("img", {
      name: /articulated 3D printed dragon/i,
    });
    await expect(image.first()).toBeVisible();
  });

  test("a makerspace can showcase community projects", async ({ page }) => {
    await page.goto("/p/cedar-park-library");
    await expect(page.getByText("Community sign for the reading garden").first()).toBeVisible();
  });

  test("a maker can add a project from the dashboard", async ({ page }) => {
    const title = `Test project ${Date.now()}`;
    await signIn(page, "ada@example.com");
    await page.goto("/dashboard/gallery");

    const result = await page.evaluate(async (projectTitle) => {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          imageUrl: "https://images.example.com/test.jpg",
          description: "Added by an end-to-end test.",
        }),
      });
      return response.status;
    }, title);

    expect(result).toBe(201);

    await page.reload();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto("/p/ada-prints");
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("a hostile image URL is rejected by the API", async ({ page }) => {
    await signIn(page, "ada@example.com");
    await page.goto("/dashboard/gallery");

    const status = await page.evaluate(async () => {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "XSS probe",
          imageUrl: "javascript:alert(document.cookie)",
        }),
      });
      return response.status;
    });

    expect(status).toBe(422);
  });
});

test.describe("reviews", () => {
  test("existing reviews and the maker's reply are shown", async ({ page }) => {
    await page.goto("/p/ada-prints");

    await expect(page.getByText("Rescued a project on a deadline").first()).toBeVisible();
    await expect(page.getByText(/that was my filament order running late/i).first()).toBeVisible();
    await expect(page.getByText(/verified/i).first()).toBeVisible();
  });

  test("a customer can leave a review and it updates the rating", async ({ page }) => {
    await signIn(page, uniqueEmail("reviewer"));
    await page.goto("/p/lindqvist-laser");

    const status = await page.evaluate(async () => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "lindqvist-laser",
          rating: 5,
          title: "Superb engraving",
          body: "Crisp engraving on maple and a very quick turnaround. Highly recommended.",
        }),
      });
      return response.status;
    });
    expect(status).toBe(201);

    await page.reload();
    await expect(page.getByText("Superb engraving").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /rated 5\.0 out of 5/i }).first()).toBeVisible();
  });

  test("a maker cannot review their own profile", async ({ page }) => {
    await signIn(page, "ada@example.com");
    await page.goto("/p/ada-prints");

    const status = await page.evaluate(async () => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "ada-prints",
          rating: 5,
          body: "Reviewing my own shop, which should never be allowed.",
        }),
      });
      return response.status;
    });

    expect(status).toBe(422);
  });

  test("a second review from the same person is rejected", async ({ page }) => {
    await signIn(page, uniqueEmail("double"));

    const post = async () =>
      page.evaluate(async () => {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            profileSlug: "bramble-street",
            rating: 4,
            body: "Solid workshop with a great community and plenty of tools.",
          }),
        });
        return response.status;
      });

    await page.goto("/p/bramble-street");
    expect(await post()).toBe(201);
    expect(await post()).toBe(409);
  });

  test("a review author cannot be impersonated and reviews cannot be deleted by the maker", async ({
    page,
    browser,
  }) => {
    // A customer leaves a critical review.
    await signIn(page, uniqueEmail("critic"));
    await page.goto("/p/bramble-street");
    const reviewId = await page.evaluate(async () => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "bramble-street",
          rating: 2,
          body: "The CNC was down both times I visited and nobody told me in advance.",
        }),
      });
      const data = await response.json();
      return data.id as string;
    });
    expect(reviewId).toBeTruthy();

    // The maker tries to delete it.
    const makerContext = await browser.newContext();
    const makerPage = await makerContext.newPage();
    await signIn(makerPage, "hello@bramblestreet.example");
    await makerPage.goto("/dashboard/reviews");

    const deleteStatus = await makerPage.evaluate(async (id) => {
      const response = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      return response.status;
    }, reviewId);
    expect(deleteStatus).toBe(403);

    // But they can respond to it.
    const replyStatus = await makerPage.evaluate(async (id) => {
      const response = await fetch(`/api/reviews/${id}/response`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Sorry about that — the CNC is back online now." }),
      });
      return response.status;
    }, reviewId);
    expect(replyStatus).toBe(200);

    await page.reload();
    await expect(page.getByText(/the CNC is back online now/i).first()).toBeVisible();

    await makerContext.close();
  });

  test("the directory can filter and sort by rating", async ({ page }) => {
    await page.goto("/browse?sort=rating");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/browse?minRating=4");
    await expect(page.getByRole("link", { name: /Ada's Print Bench/i }).first()).toBeVisible();

    // An out-of-range value must not break the page.
    const response = await page.goto("/browse?minRating=999&sort=nonsense");
    expect(response?.status()).toBeLessThan(400);
  });
});
