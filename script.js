// Replace with your API key and channel ID
const apiKey = 'AIzaSyBE4JVomEFETbYty96awrwpAqh50jqgKK8';
const channelId = 'UC9DxBA4SBq5R_OkBm87CimQ';

// Global variables for chart data and additional metrics
let uploadDateCounts = {};  // { 'YYYY-MM-DD': count }
let videoVPHData = [];      // Array of objects: { date, title, vph }
let allVideoData = [];      // Detailed video data array
let subscriberHistory = []; // Array to track { timestamp, subscribers }

let chartUploadInstance = null;
let chartVPHInstance = null;
let chartSubscriberInstance = null;

/**
 * Helper Functions
 */

// Calculate hours difference between two dates
function hoursSince(date) {
  if (!date) return 0;
  const diff = Date.now() - new Date(date).getTime();
  return diff / (1000 * 60 * 60);
}

// Format numbers with commas
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return Number(num).toLocaleString();
}

// Convert ISO8601 duration to H:MM:SS format
function parseDuration(isoDuration) {
  if (!isoDuration) return '0:00';
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = isoDuration.match(regex);
  if (!matches) return '0:00';
  let hours = parseInt(matches[1] || 0, 10);
  let minutes = parseInt(matches[2] || 0, 10);
  let seconds = parseInt(matches[3] || 0, 10);
  return `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Convert ISO8601 duration to total seconds
function parseDurationSeconds(isoDuration) {
  if (!isoDuration) return 0;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = isoDuration.match(regex);
  if (!matches) return 0;
  let hours = parseInt(matches[1] || 0, 10);
  let minutes = parseInt(matches[2] || 0, 10);
  let seconds = parseInt(matches[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Main Dashboard Logic
 */

// Reset and fetch all data
function updateDashboard() {
  // Reset global data
  uploadDateCounts = {};
  videoVPHData = [];
  allVideoData = [];

  // Set loading messages
  document.getElementById('channelStats').innerHTML =
    `<p class="loading">Loading channel stats...</p>`;
  document.getElementById('uploadFrequency').innerHTML =
    `<p class="loading">Calculating upload frequencies...</p>`;
  document.getElementById('additionalData').innerHTML =
    `<p class="loading">Fetching additional video metrics...</p>`;
  document.getElementById('topVideos').innerHTML =
    `<p class="loading">Loading top performing videos...</p>`;
  document.getElementById('recentComments').innerHTML =
    `<p class="loading">Loading recent comments from the latest video...</p>`;
  document.getElementById('videoGridContainer').innerHTML = '';
  document.getElementById('shortsContainer').innerHTML = '';
  document.getElementById('channelPostsContainer').innerHTML =
    `<p class="loading">Loading posts...</p>`;
  document.getElementById('alertsContainer').innerHTML = '<p>No alerts.</p>';

  // Destroy existing charts if they exist
  if (chartUploadInstance) { chartUploadInstance.destroy(); chartUploadInstance = null; }
  if (chartVPHInstance) { chartVPHInstance.destroy(); chartVPHInstance = null; }
  if (chartSubscriberInstance) { chartSubscriberInstance.destroy(); chartSubscriberInstance = null; }

  // Begin data fetch
  fetchChannelDetails();
  fetchChannelPosts();
}

// Fetch channel details & branding info
function fetchChannelDetails() {
  fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${channelId}&key=${apiKey}`
  )
    .then(response => response.json())
    .then(data => {
      if (!data.items || data.items.length === 0) {
        document.getElementById('channelStats').innerHTML =
          `<p>Error: Channel not found.</p>`;
        return;
      }

      const channel = data.items[0];
      const snippet = channel.snippet || {};
      const statistics = channel.statistics || {};
      const contentDetails = channel.contentDetails || {};
      const brandingSettings = channel.brandingSettings || {};
      const channelDescription = snippet.description || "No description available";
      const channelCountry = snippet.country || "Not specified";
      const customUrl = snippet.customUrl || "Not available";
      const thumbnails = snippet.thumbnails || {};
      const channelThumbnail = thumbnails.default ? thumbnails.default.url : '';
      const bannerImage =
        brandingSettings.image && brandingSettings.image.bannerExternalUrl
          ? brandingSettings.image.bannerExternalUrl
          : '';

      // Update subscriber history
      const currentSubscribers = parseInt(statistics.subscriberCount || 0, 10);
      subscriberHistory.push({ timestamp: Date.now(), subscribers: currentSubscribers });
      // Keep only last 24 hours
      subscriberHistory = subscriberHistory.filter(
        item => Date.now() - item.timestamp < 24 * 3600 * 1000
      );

      // Calculate overall channel metrics
      const channelHours = hoursSince(snippet.publishedAt);
      const totalViews = parseInt(statistics.viewCount || 0, 10);
      const totalVideos = parseInt(statistics.videoCount || 0, 10);
      const overallVPH = channelHours > 0 ? totalViews / channelHours : 0;
      const avgViewsPerVideo = totalVideos > 0 ? totalViews / totalVideos : 0;

      // Render channel stats
      document.getElementById('channelStats').innerHTML = `
        <div style="display: flex; align-items: center;">
          ${
            channelThumbnail
              ? `<img src="${channelThumbnail}" alt="Channel Thumbnail" style="border-radius:50%; margin-right:15px;">`
              : ''
          }
          <div>
            <p><strong>Channel Title:</strong> ${snippet.title || 'Untitled'}</p>
            <p><strong>Created on:</strong> ${
              snippet.publishedAt
                ? new Date(snippet.publishedAt).toLocaleDateString()
                : 'Unknown'
            }</p>
            <p><strong>Custom URL:</strong> ${customUrl}</p>
            <p><strong>Country:</strong> ${channelCountry}</p>
          </div>
        </div>
        ${
          bannerImage
            ? `<img src="${bannerImage}" alt="Channel Banner" style="width:100%; margin-top:15px; border-radius:4px;">`
            : ''
        }
        <p><strong>Description:</strong> ${channelDescription}</p>
        <p><strong>Subscribers:</strong> ${formatNumber(statistics.subscriberCount)}</p>
        <p><strong>Total Views:</strong> ${formatNumber(totalViews)}</p>
        <p><strong>Total Videos:</strong> ${formatNumber(totalVideos)}</p>
        <p><strong>Overall VPH (Channel):</strong> ${overallVPH.toFixed(2)}</p>
        <p><strong>Average Views per Video:</strong> ${avgViewsPerVideo.toFixed(2)}</p>
      `;

      renderSubscriberGrowthChart();

      // If there's an uploads playlist, fetch it
      const uploadsPlaylistId =
        contentDetails.relatedPlaylists && contentDetails.relatedPlaylists.uploads
          ? contentDetails.relatedPlaylists.uploads
          : null;
      if (uploadsPlaylistId) {
        fetchPlaylistItems(uploadsPlaylistId);
      } else {
        document.getElementById('uploadFrequency').innerHTML =
          `<p>No uploads playlist found for this channel.</p>`;
      }
    })
    .catch(error => {
      console.error('Error fetching channel details:', error);
      document.getElementById('channelStats').innerHTML =
        `<p>Error fetching channel stats. Please check your API key and channel ID.</p>`;
    });
}

// Fetch recent community posts (if any) via activities endpoint
function fetchChannelPosts() {
  fetch(
    `https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&channelId=${channelId}&key=${apiKey}`
  )
    .then(response => response.json())
    .then(data => {
      if (!data.items || data.items.length === 0) {
        document.getElementById('channelPostsContainer').innerHTML =
          `<p>No posts found or community tab is unavailable.</p>`;
        return;
      }

      // Filter only "post" type activities
      const posts = data.items.filter(
        item => item.snippet && item.snippet.type === 'post'
      );
      if (posts.length === 0) {
        document.getElementById('channelPostsContainer').innerHTML =
          `<p>No posts found.</p>`;
        return;
      }

      renderChannelPosts(posts);
    })
    .catch(error => {
      console.error('Error fetching channel posts:', error);
      document.getElementById('channelPostsContainer').innerHTML =
        `<p>Error fetching posts.</p>`;
    });
}

// Render posts
function renderChannelPosts(posts) {
  let html = '';
  posts.forEach(post => {
    const snippet = post.snippet || {};
    const title = snippet.title || 'Post';
    const description = snippet.description || '';
    const postTime = snippet.publishedAt
      ? new Date(snippet.publishedAt).toLocaleString()
      : 'Unknown date';

    html += `
      <div class="post-tile">
        <p><strong>${title}</strong></p>
        <p>${description}</p>
        <p><em>${postTime}</em></p>
        <p><a href="https://www.youtube.com/channel/${channelId}/community" target="_blank">View Post on YouTube</a></p>
      </div>
    `;
  });

  document.getElementById('channelPostsContainer').innerHTML = html;
}

// Fetch the latest 50 uploads
function fetchPlaylistItems(playlistId) {
  fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}`
  )
    .then(response => response.json())
    .then(data => {
      if (!data.items || data.items.length === 0) {
        document.getElementById('uploadFrequency').innerHTML =
          `<p>Error: No uploads found or playlist is empty.</p>`;
        return;
      }

      const videoIds = [];
      const now = new Date();
      let uploadsLastDay = 0;
      let uploadsLastWeek = 0;
      let uploadsLastMonth = 0;

      data.items.forEach(item => {
        const snippet = item.snippet;
        if (!snippet || !snippet.publishedAt) return; // Skip incomplete data

        const pubDate = new Date(snippet.publishedAt);
        const diffDays = (now - pubDate) / (1000 * 60 * 60 * 24);

        if (diffDays <= 1) uploadsLastDay++;
        if (diffDays <= 7) uploadsLastWeek++;
        if (diffDays <= 30) uploadsLastMonth++;

        const dateStr = pubDate.toISOString().split('T')[0];
        uploadDateCounts[dateStr] = (uploadDateCounts[dateStr] || 0) + 1;

        // Extract video ID
        const resourceId = snippet.resourceId || {};
        if (resourceId.videoId) {
          videoIds.push(resourceId.videoId);
        }
      });

      document.getElementById('uploadFrequency').innerHTML = `
        <p><strong>Uploads in the last day:</strong> ${uploadsLastDay}</p>
        <p><strong>Uploads in the last week:</strong> ${uploadsLastWeek}</p>
        <p><strong>Uploads in the last month:</strong> ${uploadsLastMonth}</p>
      `;

      renderUploadTrendChart();
      if (videoIds.length > 0) {
        fetchVideoDetails(videoIds);
      }
    })
    .catch(error => {
      console.error('Error fetching playlist items:', error);
      document.getElementById('uploadFrequency').innerHTML =
        `<p>Error fetching upload data.</p>`;
    });
}

// Fetch video details for an array of IDs
function fetchVideoDetails(videoIds) {
  const ids = videoIds.join(',');
  fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${apiKey}`
  )
    .then(response => response.json())
    .then(data => {
      if (!data.items || data.items.length === 0) {
        console.warn('No video details found.');
        return;
      }

      data.items.forEach(video => {
        const stats = video.statistics || {};
        const snippet = video.snippet || {};
        const contentDetails = video.contentDetails || {};

        // Basic checks
        if (!snippet.publishedAt) return;

        const publishedAt = snippet.publishedAt;
        const durationSec = parseDurationSeconds(contentDetails.duration);
        const hoursOld = hoursSince(publishedAt);
        const viewCount = parseInt(stats.viewCount || 0, 10);
        const likeCount = parseInt(stats.likeCount || 0, 10);
        const commentCount = parseInt(stats.commentCount || 0, 10);

        // Calculate VPH
        const videoVPH = hoursOld > 0 ? viewCount / hoursOld : 0;

        // Prepare data object
        const videoObj = {
          id: video.id,
          title: snippet.title || 'Untitled',
          publishedAt: publishedAt,
          viewCount: viewCount,
          likeCount: likeCount,
          commentCount: commentCount,
          duration: parseDuration(contentDetails.duration),
          durationSeconds: durationSec,
          vph: videoVPH,
          likeToView: viewCount > 0 ? likeCount / viewCount : 0,
          commentToView: viewCount > 0 ? commentCount / viewCount : 0,
          thumbnail:
            snippet.thumbnails && snippet.thumbnails.medium
              ? snippet.thumbnails.medium.url
              : '',
        };

        // Push to arrays
        videoVPHData.push({
          date: new Date(publishedAt).toLocaleDateString(),
          title: videoObj.title,
          vph: videoVPH,
        });

        allVideoData.push(videoObj);
      });

      // Sort by published date
      videoVPHData.sort((a, b) => new Date(a.date) - new Date(b.date));

      renderVPHChart();
      displayAdditionalData();
      displayTopVideos();
      renderVideoGrid();
      renderShorts();

      // Get the most recent video for comments
      const sortedVideos = [...allVideoData].sort(
        (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
      );
      if (sortedVideos.length > 0) {
        fetchRecentComments(sortedVideos[0].id);
      } else {
        document.getElementById('recentComments').innerHTML =
          `<p>No recent comments available.</p>`;
      }

      checkAlerts();
      updatePredictions();
    })
    .catch(error => {
      console.error('Error fetching video details:', error);
    });
}

/**
 * Charts
 */

// Upload Trend Chart
function renderUploadTrendChart() {
  const dates = Object.keys(uploadDateCounts).sort();
  const counts = dates.map(date => uploadDateCounts[date]);
  const ctx = document.getElementById('uploadTrendChart').getContext('2d');
  chartUploadInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Number of Uploads',
          data: counts,
          backgroundColor: 'rgba(25, 118, 210, 0.5)',
          borderColor: 'rgba(25, 118, 210, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { beginAtZero: true, title: { display: true, text: 'Uploads' } },
      },
    },
  });
}

// Video VPH Trend Chart
function renderVPHChart() {
  const labels = videoVPHData.map(item => item.date);
  const vphValues = videoVPHData.map(item => item.vph.toFixed(2));
  const ctx = document.getElementById('vphChart').getContext('2d');
  chartVPHInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Video VPH',
          data: vphValues,
          fill: false,
          tension: 0.1,
          borderColor: 'rgba(25, 118, 210, 1)',
          backgroundColor: 'rgba(25, 118, 210, 0.5)',
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Published Date' } },
        y: { beginAtZero: true, title: { display: true, text: 'Views per Hour' } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => `VPH: ${context.parsed.y}`,
          },
        },
      },
    },
  });
}

// Subscriber Growth Chart
function renderSubscriberGrowthChart() {
  const labels = subscriberHistory.map(item =>
    new Date(item.timestamp).toLocaleTimeString()
  );
  const dataPoints = subscriberHistory.map(item => item.subscribers);
  const ctx = document.getElementById('subscriberGrowthChart').getContext('2d');
  chartSubscriberInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Subscribers',
          data: dataPoints,
          fill: false,
          tension: 0.1,
          borderColor: 'rgba(255, 193, 7, 1)',
          backgroundColor: 'rgba(255, 193, 7, 0.5)',
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Time' } },
        y: { beginAtZero: true, title: { display: true, text: 'Subscribers' } },
      },
    },
  });
}

/**
 * Rendering & Tables
 */

// Display additional video metrics
function displayAdditionalData() {
  if (allVideoData.length === 0) return;
  let totalVPH = 0;
  let highestVPH = -Infinity;
  let lowestVPH = Infinity;
  let highestVideo = null;
  let lowestVideo = null;

  allVideoData.forEach(video => {
    totalVPH += video.vph;
    if (video.vph > highestVPH) {
      highestVPH = video.vph;
      highestVideo = video;
    }
    if (video.vph < lowestVPH) {
      lowestVPH = video.vph;
      lowestVideo = video;
    }
  });

  const avgVideoVPH = allVideoData.length > 0 ? totalVPH / allVideoData.length : 0;

  document.getElementById('additionalData').innerHTML = `
    <p><strong>Average VPH (Recent Videos):</strong> ${avgVideoVPH.toFixed(2)}</p>
    <p><strong>Highest VPH Video:</strong> ${
      highestVideo ? highestVideo.title : 'N/A'
    } (${highestVPH.toFixed(2)} VPH)</p>
    <p><strong>Lowest VPH Video:</strong> ${
      lowestVideo ? lowestVideo.title : 'N/A'
    } (${lowestVPH.toFixed(2)} VPH)</p>
  `;
}

// Display top performing videos (top 5 by views)
function displayTopVideos() {
  if (allVideoData.length === 0) return;
  const sortedVideos = [...allVideoData].sort((a, b) => b.viewCount - a.viewCount);
  const topVideos = sortedVideos.slice(0, 5);
  let tableHTML = `<h2>Top 5 Videos by Views</h2>
    <table>
      <tr>
        <th>Title</th>
        <th>Published</th>
        <th>Views</th>
        <th>Likes</th>
        <th>Comments</th>
        <th>Duration</th>
        <th>Like/View Ratio</th>
        <th>Comment/View Ratio</th>
        <th>VPH</th>
      </tr>`;

  topVideos.forEach(video => {
    tableHTML += `<tr>
      <td>${video.title}</td>
      <td>${new Date(video.publishedAt).toLocaleDateString()}</td>
      <td>${formatNumber(video.viewCount)}</td>
      <td>${formatNumber(video.likeCount)}</td>
      <td>${formatNumber(video.commentCount)}</td>
      <td>${video.duration}</td>
      <td>${(video.likeToView * 100).toFixed(2)}%</td>
      <td>${(video.commentToView * 100).toFixed(2)}%</td>
      <td>${video.vph.toFixed(2)}</td>
    </tr>`;
  });
  tableHTML += `</table>`;
  document.getElementById('topVideos').innerHTML = tableHTML;
}

// Render a video grid with clickable thumbnails
function renderVideoGrid() {
  const container = document.getElementById('videoGridContainer');
  if (allVideoData.length === 0) {
    container.innerHTML = '<p>No videos found.</p>';
    return;
  }

  allVideoData.forEach(video => {
    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
        <img src="${video.thumbnail}" alt="${video.title}">
        <p>${video.title}</p>
      </a>`;
    container.appendChild(tile);
  });
}

// Render YouTube Shorts (videos < 60s)
function renderShorts() {
  const container = document.getElementById('shortsContainer');
  const shorts = allVideoData.filter(video => video.durationSeconds < 60);
  if (shorts.length === 0) {
    container.innerHTML = '<p>No Shorts found.</p>';
    return;
  }
  shorts.forEach(video => {
    const tile = document.createElement('div');
    tile.className = 'shorts-tile';
    tile.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
        <img src="${video.thumbnail}" alt="${video.title}">
        <p>${video.title}</p>
        <p>${video.duration}</p>
      </a>`;
    container.appendChild(tile);
  });
}

/**
 * Comments & Alerts
 */

// Fetch recent comments (latest 5) from most recent video
function fetchRecentComments(videoId) {
  fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=5&key=${apiKey}`
  )
    .then(response => response.json())
    .then(data => {
      if (!data.items || data.items.length === 0) {
        document.getElementById('recentComments').innerHTML =
          `<p>No recent comments available.</p>`;
        return;
      }
      let commentsHTML = `<h2>Recent Comments</h2><ul>`;
      data.items.forEach(item => {
        const snippet = item.snippet || {};
        const topComment = snippet.topLevelComment || {};
        const commentDetails = topComment.snippet || {};
        const author = commentDetails.authorDisplayName || 'Anonymous';
        const text = commentDetails.textDisplay || '';
        commentsHTML += `<li><strong>${author}:</strong> ${text} <em>(sentiment: N/A)</em></li>`;
      });
      commentsHTML += `</ul>`;
      document.getElementById('recentComments').innerHTML = commentsHTML;
    })
    .catch(error => {
      console.error('Error fetching recent comments:', error);
      document.getElementById('recentComments').innerHTML =
        `<p>Error fetching recent comments.</p>`;
    });
}

// Basic alerts (low engagement, no recent uploads)
function checkAlerts() {
  let alerts = [];
  if (allVideoData.length > 0) {
    const avgLikeRatio =
      allVideoData.reduce((sum, v) => sum + v.likeToView, 0) / allVideoData.length;
    if (avgLikeRatio < 0.005) {
      alerts.push('Average like/view ratio is below 0.5%. Consider reviewing your content strategy.');
    }
  }

  const now = new Date();
  const recentUploads = Object.keys(uploadDateCounts).filter(dateStr => {
    const date = new Date(dateStr);
    return now - date < 24 * 3600 * 1000;
  });
  if (recentUploads.length === 0) {
    alerts.push('No uploads in the last 24 hours.');
  }

  document.getElementById('alertsContainer').innerHTML =
    alerts.length > 0 ? alerts.map(a => `<p>${a}</p>`).join('') : `<p>No alerts.</p>`;
}

/**
 * Export & Predictions
 */

// Setup export for subscriber history
function setupExport() {
  const exportButton = document.getElementById('exportButton');
  exportButton.addEventListener('click', () => {
    let csv = 'Timestamp,Subscribers\n';
    subscriberHistory.forEach(item => {
      csv += `${new Date(item.timestamp).toLocaleString()},${item.subscribers}\n`;
    });
    document.getElementById('exportOutput').textContent = csv;
  });
}

// Simple linear extrapolation for next 24 hours
function updatePredictions() {
  if (subscriberHistory.length < 2) {
    document.getElementById('predictedSubscribers').textContent = 'N/A';
    return;
  }
  const first = subscriberHistory[0];
  const last = subscriberHistory[subscriberHistory.length - 1];
  const hoursDiff = (last.timestamp - first.timestamp) / (3600 * 1000);
  if (hoursDiff <= 0) {
    document.getElementById('predictedSubscribers').textContent = 'N/A';
    return;
  }
  const growth = last.subscribers - first.subscribers;
  const hourlyGrowth = growth / hoursDiff;
  const prediction = last.subscribers + hourlyGrowth * 24;
  document.getElementById('predictedSubscribers').textContent = formatNumber(Math.round(prediction));
}

/**
 * Initialization
 */

// On load, set up export and start dashboard
setupExport();
updateDashboard();

// Auto-refresh every 60 seconds
setInterval(updateDashboard, 60000);
