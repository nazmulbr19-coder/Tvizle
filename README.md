# TVizle.tr Cloudstream 3 Extension

This repository is a ready-to-build **Cloudstream 3** extension for [`tvizle.tr`](https://tvizle.tr/) (powered by open-source `iptv-org/iptv` channel data and public HLS streams).

## How to Build `.cs3` & Install on Cloudstream

1. **Push this repository to GitHub** (on `main` or `master`).
2. **Run the GitHub Actions workflow**:
   - The workflow at `.github/workflows/build.yml` runs automatically on push, or you can trigger it manually from **Actions -> Build Cloudstream Extensions -> Run workflow**.
   - It compiles `TvizleProvider.cs3`, generates `plugins.json`, automatically updates `repo.json` with your exact GitHub repository URL, and publishes everything to the `builds` branch.
3. **Add the repository to Cloudstream Android**:
   - Open **Cloudstream -> Settings -> Extensions -> Add repository**.
   - Paste your repository link (replace `<USERNAME>` and `<REPO>` with your GitHub username and repository name):
     ```
     https://raw.githubusercontent.com/<USERNAME>/<REPO>/builds/repo.json
     ```
   - Install **TVizle.tr** from the repository list.
