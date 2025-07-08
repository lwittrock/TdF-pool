document.addEventListener('DOMContentLoaded', () => {
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const dailyHighlightsTitle = document.getElementById('daily-highlights-title');
    const dailyHighlightsContent = document.getElementById('daily-highlights-content');
    const lastUpdatedDateSpan = document.getElementById('last-updated-date');

    const DATA_PATH = './data/'; // Path to your JSON files relative to index.html

    // Function to fetch JSON data
    async function fetchData(filename) {
        try {
            const response = await fetch(DATA_PATH + filename);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Could not fetch ${filename}:`, error);
            return null;
        }
    }

    // Function to render the current leaderboard
    async function renderLeaderboard() {
        leaderboardContainer.innerHTML = '<p>Fetching current standings...</p>';
        const leaderboard = await fetchData('cumulative_leaderboard.json');

        if (leaderboard && leaderboard.length > 0) {
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Participant Name</th>
                            <th>Total Score</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            leaderboard.forEach(entry => {
                tableHTML += `
                    <tr>
                        <td>${entry.rank}</td>
                        <td>${entry.participant_name}</td>
                        <td>${entry.total_score}</td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            leaderboardContainer.innerHTML = tableHTML;
        } else {
            leaderboardContainer.innerHTML = '<p>No current leaderboard data available.</p>';
        }
    }

    // Function to render daily highlights
    async function renderDailyHighlights() {
        dailyHighlightsContent.innerHTML = '<p>Fetching daily highlights...</p>';
        const riderHistory = await fetchData('rider_points_history.json');

        if (riderHistory && riderHistory.length > 0) {
            // Get the data for the most recent stage
            const latestStageData = riderHistory[riderHistory.length - 1];
            const stageNumber = latestStageData.stage_number;
            const dailyRiderPoints = latestStageData.daily_rider_points;
            const updateDate = latestStageData.date;

            dailyHighlightsTitle.textContent = `Daily Highlights (Stage ${stageNumber})`;
            lastUpdatedDateSpan.textContent = updateDate;

            // Sort daily rider points to find top performers of the day
            const sortedDailyPoints = Object.entries(dailyRiderPoints)
                .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
                .filter(([, points]) => points > 0); // Only show riders who scored points

            if (sortedDailyPoints.length > 0) {
                let highlightsHTML = '<ul>';
                sortedDailyPoints.slice(0, 5).forEach(([rider, points]) => { // Show top 5
                    highlightsHTML += `<li>${rider}: +${points} points</li>`;
                });
                highlightsHTML += '</ul>';
                dailyHighlightsContent.innerHTML = highlightsHTML;
            } else {
                dailyHighlightsContent.innerHTML = '<p>No daily points scored for this stage.</p>';
            }

        } else {
            dailyHighlightsTitle.textContent = `Daily Highlights (No Data)`;
            dailyHighlightsContent.innerHTML = '<p>No historical rider point data available.</p>';
        }
    }

    // Call rendering functions on page load
    renderLeaderboard();
    renderDailyHighlights();
});