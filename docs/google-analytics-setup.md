# Google Analytics 4 (GA4) Setup and Variable Guide

This guide details how to set up Google Analytics 4 (GA4) for the Sakura3 ecosystem, retrieve the required environment variables, and configure them for all apps (`community-portal`, `ipl-finder`, `community-docs`).

---

## 1. Setup in the Google Analytics Console

Follow these steps to create a unified GA4 property and get your Measurement ID.

### Step 1: Create a GA4 Account & Property
1. Go to the [Google Analytics Admin Console](https://analytics.google.com/).
2. Click **Create Account** (if you don't already have one for this project) and name it **Sakura3 Ecosystem**.
3. Under the account, click **Create Property**:
   * **Property Name:** `Sakura3 Apps` (or similar)
   * **Reporting Time Zone:** Set to your local time zone.
   * **Currency:** Choose your preferred currency.
4. Click **Next** and fill in your business details, then click **Create**.

### Step 2: Create a Web Data Stream
Since we are using a **Single Property with a Unified Data Stream** to allow cross-subdomain user tracking:
1. In the property settings, under *Data collection and modification*, click **Data Streams**.
2. Click **Add stream** and select **Web**.
3. Enter the primary landing page domain:
   * **Website URL:** `https://portal.sakura3.id` (or your root production domain)
   * **Stream Name:** `Sakura3 Web Apps`
4. Leave **Enhanced Measurement** enabled (it is on by default).
5. Click **Create stream**.

### Step 3: Configure SPA / Route tracking in Enhanced Measurement
GA4 automatically captures route changes for Single Page Applications (SPAs) using history events.
1. In the stream details page, click the **Gear icon** in the **Enhanced Measurement** section.
2. Under **Page Views**, click **Show advanced settings**.
3. Ensure that **Page changes based on browser history events** is checked.
4. Click **Save**.

### Step 4: Add Cross-Domain Configuration (If applicable)
If users traverse between distinct root domains (e.g. `sakura3.id` and `veryresto.com`):
1. In your Web Stream details page, click **Configure tag settings** (at the bottom under Google Tag).
2. Click **Configure your domains**.
3. Under *Include domains that match the following conditions*, click **Add condition**:
   * Match Type: `Contains` | Domain: `sakura3.id`
   * Match Type: `Contains` | Domain: `sr3.my.id`
   * Match Type: `Contains` | Domain: `veryresto.com`
4. Click **Save**.

---

## 2. Retrieving the Measurement ID

Once your Web Data Stream is created, you can obtain your tracking ID:
1. In the GA4 Admin Console, go to **Data Streams**.
2. Select your newly created **Sakura3 Web Apps** stream.
3. In the top-right corner of the Stream details panel, locate the **MEASUREMENT ID**.
4. The ID will follow the format: **`G-XXXXXXXXXX`** (e.g., `G-B52X7Z9YKL`). Copy this value.

---

## 3. Configuring the Environment Variables

For the frontend codebases to read this ID, it must be exposed as a build-time environment variable prefixed with `VITE_`.

### Required Variable:
* Name: `VITE_GA_MEASUREMENT_ID`
* Value: `G-XXXXXXXXXX` (Your GA4 Measurement ID)

### Setup in Each Application:

#### A. Local Development (`.env` or `.env.local` files)
To test analytics locally, create or update a `.env` file in the root of the respective project:
```bash
# Example local configuration
VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```
*(If this variable is not defined or is left empty, the analytics scripts will automatically bypass initialization to prevent local development data from skewing your production statistics).*

#### B. Production Deployments (Fly.io)
Since these apps are Vite Single Page Applications (SPAs), Vite embeds the environment variables into the static javascript files **at build time**. Therefore, they must be passed as build arguments during deployment, rather than runtime environment variables.

In your deployment scripts or CI/CD pipelines, pass the measurement ID as a build argument:
```bash
# Example Fly.io deployment command
fly deploy --build-arg VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

If you deploy using `fly.toml` or Fly.io dashboards, verify that the argument is set under your build configs:
```toml
[build.args]
VITE_GA_MEASUREMENT_ID = "G-XXXXXXXXXX"
```

---

## 4. Custom Definitions Setup (GA4 Admin Console)

To enrich your reports, you should register the custom parameters we send in the code as GA4 Custom Dimensions.

1. In the GA4 Property settings, go to **Custom Definitions** under the property column.
2. Select the **Custom Dimensions** tab and click **Create custom dimensions**.
3. Create the following dimensions:

| Dimension Name | Scope | Description | Event Parameter |
| :--- | :--- | :--- | :--- |
| **App Name** | Event | Tracks which application fired the event (`community_portal`, `ipl_finder`, or `community_docs`). | `app_name` |
| **User Role** | User | Tracks user access roles (e.g. `admin`, `verifier`, `user`). | `user_role` |
| **Participant Type** | User | Tracks the classification type of the user (e.g. `resident`, `non_resident`). | `participant_type` |

4. Click **Save** for each dimension. They will become available in your Analysis Hub and standard report filters within 24 hours of receiving events.
