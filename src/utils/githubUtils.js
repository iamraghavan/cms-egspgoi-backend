// GitHub Asset Uploader
// Uses global fetch (Node 18+)


const {
    GITHUB_TOKEN,
    ASSET_GH_OWNER,
    ASSET_GH_REPO,
    ASSET_GH_BRANCH,
    ASSET_ALLOWED_EXT
} = process.env;

/**
 * Uploads a file buffer to GitHub Repository
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - Original filename
 * @param {string} mimeType - e.g. image/png
 * @returns {Promise<string>} - The public raw URL of the uploaded file
 */
const uploadToGitHub = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!GITHUB_TOKEN || !ASSET_GH_OWNER || !ASSET_GH_REPO) {
            throw new Error("GitHub Asset configuration missing.");
        }

        // 1. Validate Extension
        const ext = fileName.split('.').pop().toLowerCase();
        const allowed = ASSET_ALLOWED_EXT ? ASSET_ALLOWED_EXT.split(',') : ['jpg', 'png', 'webp'];
        if (!allowed.includes(ext)) {
            throw new Error(`File type .${ext} not allowed.`);
        }

        // 2. Generate Unique Path
        // assets/YYYY/MM/timestamp-sanitized_name
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const timestamp = Date.now();
        const sanitizedParams = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const path = `assets/${year}/${month}/${timestamp}-${sanitizedParams}`;

        // 3. GitHub API requires Base64
        const contentBase64 = fileBuffer.toString('base64');

        const url = `https://api.github.com/repos/${ASSET_GH_OWNER}/${ASSET_GH_REPO}/contents/${path}`;

        console.log(`Uploading to GitHub: ${url}`);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'CMS-Backend'
            },
            body: JSON.stringify({
                message: `Upload asset: ${fileName}`,
                content: contentBase64,
                branch: ASSET_GH_BRANCH || 'main'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`GitHub Upload Failed: ${data.message}`);
        }

        // 4. Construct Public URL (Using jsDelivr for CDN speed or raw.githubusercontent)
        // Raw: https://raw.githubusercontent.com/OWNER/REPO/BRANCH/PATH
        // JsDelivr: https://cdn.jsdelivr.net/gh/OWNER/REPO@BRANCH/PATH

        // Let's use raw.githubusercontent for now as it updates faster.
        const rawUrl = `https://raw.githubusercontent.com/${ASSET_GH_OWNER}/${ASSET_GH_REPO}/${ASSET_GH_BRANCH || 'main'}/${path}`;

        return rawUrl;

    } catch (error) {
        console.error("GitHub Upload Error:", error);
        throw error;
    }
};

module.exports = { uploadToGitHub };
