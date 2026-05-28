// Simulate a slow email service (takes 2-3 seconds)
export async function sendWelcomeEmail(
  email: string,
): Promise<{ sent: boolean; email: string }> {
  // Random delay between 1500-3000ms to simulate real API variance
  const delay = 1500 + Math.random() * 1500;
  await sleep(delay);

  // 10% chance of failure (shows retry logic)
  if (Math.random() < 0.1) {
    throw new Error("Email service temporarily unavailable");
  }

  return { sent: true, email };
}

// Simulate generating profile thumbnails (takes 1-3 seconds)
export async function generateThumbnail(
  userId: string,
): Promise<{ url: string; size: string }> {
  const delay = 1000 + Math.random() * 2000;
  await sleep(delay);

  return {
    url: `https://cdn.example.com/avatars/${userId}_thumb.jpg`,
    size: "200x200",
  };
}

// Simulate syncing to CRM (takes 500ms-1.5s)
export async function syncToCRM(userData: {
  name: string;
  email: string;
}): Promise<{ synced: boolean }> {
  const delay = 500 + Math.random() * 1000;
  await sleep(delay);

  return { synced: true };
}

// Simulate generating a welcome PDF (takes 3-5 seconds)
export async function generateWelcomePDF(userData: {
  name: string;
}): Promise<{ url: string }> {
  const delay = 3000 + Math.random() * 2000;
  await sleep(delay);

  return { url: `https://cdn.example.com/welcome/${userData.name}.pdf` };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
