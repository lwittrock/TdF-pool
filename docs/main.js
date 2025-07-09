document.addEventListener('DOMContentLoaded', () => {
    // Common elements
    const lastUpdatedDateSpan = document.getElementById('last-updated-date');
    const DATA_PATH = './data/';

    // --- Helper Functions ---
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

    function createTable(headers, data, idPrefix = '', rankKey = null) {
        if (!data || data.length === 0) {
            return '<p>No data available.</p>';
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;
        data.forEach((row, index) => {
            let rowClass = '';
            if (rankKey && row[rankKey]) {
                if (row[rankKey] === 1) rowClass = 'rank-1';
                else if (row[rankKey] === 2) rowClass = 'rank-2';
                else if (row[rankKey] === 3) rowClass = 'rank-3';
            }
            tableHTML += `<tr class="${rowClass}">`;
            headers.forEach(header => {
                // Convert header name to data key (e.g., "Participant Name" -> "participant_name")
                const dataKey = header.toLowerCase().replace(/ /g, '_').replace('total_score', 'total_score').replace('rank','rank');
                tableHTML += `<td>${row[dataKey] !== undefined ? row[dataKey] : 'N/A'}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        return tableHTML;
    }

    // --- Page-Specific Rendering Functions ---

    // --- Home Page Functions (index.html) ---
    async function renderHomePage() {
        const currentStageTitle = document.getElementById('current-stage-title');
        const topFinishersSpan = document.getElementById('top-finishers');
        const yellowJerseySpan = document.getElementById('yellow-jersey');
        const greenJerseySpan = document.getElementById('green-jersey');
        const polkaDotJerseySpan = document.getElementById('polka-dot-jersey');
        const whiteJerseySpan = document.getElementById('white-jersey');
        const topDailyParticipantsDiv = document.getElementById('top-daily-participants');
        const topCumulativeParticipantsDiv = document.getElementById('top-cumulative-participants');

        // Fetch all necessary data for the home page
        const riderHistory = await fetchData('rider_points_history.json');
        const leaderboardHistory = await fetchData('leaderboard_history.json');
        const cumulativeLeaderboard = await fetchData('cumulative_leaderboard.json'); // Direct cumulative for top 5

        if (!riderHistory || !leaderboardHistory || !cumulativeLeaderboard) {
            console.error('Failed to load required data for home page.');
            return;
        }

        // Get data for the most recent stage
        const latestRiderStageData = riderHistory[riderHistory.length - 1];
        const latestLeaderboardStageData = leaderboardHistory[leaderboardHistory.length - 1];
        
        if (!latestRiderStageData || !latestLeaderboardStageData) {
            console.warn('No stage data available yet.');
            currentStageTitle.textContent = 'No Stage Data Available Yet';
            return;
        }

        const stageNumber = latestRiderStageData.stage_number;
        const updateDate = latestRiderStageData.date;
        lastUpdatedDateSpan.textContent = updateDate;

        // Render Current Stage Info
        currentStageTitle.textContent = `Most Recent Stage: Stage ${stageNumber} (${updateDate})`;
        
        // Fetch simulated stage data directly for results and jerseys (not just points)
        // This requires the simulated_stages data to be in docs/data/simulated_stages/
        // For simplicity now, we'll derive from rider history, but ideally:
        // const latestSimulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);
        // if (latestSimulatedStageData) {
        //     const stageResults = latestSimulatedStageData.stage_results;
        //     const jerseyHolders = latestSimulatedStageData.jersey_holders;
        //     // ... use stageResults and jerseyHolders to populate ...
        // }

        // Placeholder for Stage Overview (from daily_rider_points in history for now)
        const dailyRiderPoints = latestRiderStageData.daily_rider_points;
        const sortedStageScorers = Object.entries(dailyRiderPoints)
            .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
            .filter(([, points]) => points > 0);

        if (sortedStageScorers.length > 0) {
            topFinishersSpan.textContent = sortedStageScorers.slice(0, 3).map(entry => `${entry[0]} (${entry[1]} pts)`).join(', ');
        } else {
            topFinishersSpan.textContent = 'No points scored this stage yet.';
        }

        // NOTE: Jersey holders are not directly in rider_points_history.json, they are in the raw simulated stage data.
        // For accurate jersey display, you would need to fetch docs/data/simulated_stages/stage_X_data.json
        // For now, these will likely show 'Loading...' or 'N/A' unless you manually add that data or adjust Python.
        // Assuming you'll have stage_X_data.json copied to docs/data/simulated_stages/
        const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);
        if (simulatedStageData && simulatedStageData.jersey_holders) {
            const jerseys = simulatedStageData.jersey_holders;
            yellowJerseySpan.textContent = jerseys.yellow || 'N/A';
            greenJerseySpan.textContent = jerseys.green || 'N/A';
            polkaDotJerseySpan.textContent = jerseys.polka_dot || 'N/A';
            whiteJerseySpan.textContent = jerseys.white || 'N/A';
        } else {
            yellowJerseySpan.textContent = 'N/A (data unavailable)';
            greenJerseySpan.textContent = 'N/A (data unavailable)';
            polkaDotJerseySpan.textContent = 'N/A (data unavailable)';
            whiteJerseySpan.textContent = 'N/A (data unavailable)';
        }


        // Render Top 5 Daily Scorers (Participants)
        const dailyParticipantScores = latestLeaderboardStageData.daily_participant_scores;
        if (dailyParticipantScores) {
            const sortedDailyParticipants = Object.entries(dailyParticipantScores)
                .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                .map(([name, score]) => ({ participant_name: name, daily_score: score }))
                .slice(0, 5); // Get top 5

            const headers = ["Participant Name", "Daily Score"];
            topDailyParticipantsDiv.innerHTML = createTable(headers, sortedDailyParticipants);
        } else {
            topDailyParticipantsDiv.innerHTML = '<p>No daily participant scores available for this stage.</p>';
        }

        // Render Top 5 Overall Standings (Participants)
        if (cumulativeLeaderboard) {
            const top5Cumulative = cumulativeLeaderboard.slice(0, 5);
            const headers = ["Rank", "Participant Name", "Total Score"];
            topCumulativeParticipantsDiv.innerHTML = createTable(headers, top5Cumulative, 'cumulative-rank-', 'rank');
        } else {
            topCumulativeParticipantsDiv.innerHTML = '<p>No overall standings available.</p>';
        }
    }

    // --- Full Leaderboard Page Functions (full_leaderboard.html) ---
    async function renderFullLeaderboardPage() {
        const fullLeaderboardContainer = document.getElementById('full-leaderboard-container');
        if (fullLeaderboardContainer) {
            fullLeaderboardContainer.innerHTML = '<p>Fetching complete leaderboard...</p>';
            const leaderboard = await fetchData('cumulative_leaderboard.json');

            if (leaderboard && leaderboard.length > 0) {
                const headers = ["Rank", "Participant Name", "Total Score"];
                fullLeaderboardContainer.innerHTML = createTable(headers, leaderboard, 'full-rank-', 'rank');
            } else {
                fullLeaderboardContainer.innerHTML = '<p>No complete leaderboard data available.</p>';
            }
        }
    }

    // --- Team Selection Page Functions (team_selection.html) ---
    async function renderTeamSelectionPage() {
        const teamSelectionContainer = document.getElementById('team-selection-container');
        if (teamSelectionContainer) {
            teamSelectionContainer.innerHTML = '<p>Fetching team selections...</p>';
            const participantSelectionsRaw = await fetch('../python_scripts/participant_selections.json').then(res => res.json()).catch(() => {
                // Fallback if not directly accessible or needs to be compiled into JS
                console.warn('Could not fetch participant_selections.json directly. Assuming hardcoded selections or missing file.');
                return {
                    "Participant A": ["Tadej Pogačar", "Jonas Vingegaard", "Remco Evenepoel", "Mathieu van der Poel", "Wout Van Aert", "Jasper Philipsen", "Sepp Kuss", "Julian Alaphilippe"],
                    "Participant B": ["Primož Roglič", "Juan Ayuso", "Carlos Rodríguez", "Adam Yates", "Pello Bilbao", "Tom Pidcock", "Biniam Girmay", "Mads Pedersen"],
                    "Participant C": ["Enric Mas", "Ben O'Connor", "Romain Bardet", "David Gaudu", "Simon Yates", "Christophe Laporte", "Dylan Groenewegen", "Michael Matthews"]
                };
            });
            const cumulativeRiderPoints = await fetchData('cumulative_rider_points.json');

            if (!participantSelectionsRaw || !cumulativeRiderPoints) {
                teamSelectionContainer.innerHTML = '<p>Could not load all necessary data for team selections.</p>';
                return;
            }

            let htmlContent = '';
            for (const participantName in participantSelectionsRaw) {
                htmlContent += `<h3>${participantName}</h3>`;
                htmlContent += `
                    <table>
                        <thead>
                            <tr>
                                <th>Rider</th>
                                <th>Cumulative Points</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                const selectedRiders = participantSelectionsRaw[participantName];
                selectedRiders.forEach(rider => {
                    const points = cumulativeRiderPoints[rider] || 0;
                    htmlContent += `
                        <tr>
                            <td>${rider}</td>
                            <td>${points}</td>
                        </tr>
                    `;
                });
                htmlContent += `</tbody></table>`;
            }
            teamSelectionContainer.innerHTML = htmlContent;
        }
    }

    // --- Stages Page Functions (stages.html) ---
    async function renderStagesPage() {
        const stageSelect = document.getElementById('stage-select');
        const selectedStageDetails = document.getElementById('selected-stage-details');

        const riderHistory = await fetchData('rider_points_history.json');
        
        if (!riderHistory || riderHistory.length === 0) {
            stageSelect.innerHTML = '<option value="">No stages available</option>';
            selectedStageDetails.innerHTML = '<p>No stage data available yet.</p>';
            return;
        }

        // Populate dropdown with stages
        stageSelect.innerHTML = '<option value="">Select a Stage</option>';
        riderHistory.forEach(stageData => {
            const option = document.createElement('option');
            option.value = stageData.stage_number;
            option.textContent = `Stage ${stageData.stage_number} (${stageData.date})`;
            stageSelect.appendChild(option);
        });

        // Function to display details for a selected stage
        async function displayStageDetails(stageNumber) {
            selectedStageDetails.innerHTML = `<p>Loading details for Stage ${stageNumber}...</p>`;
            
            // Get the specific stage data from history for daily rider points
            const stageHistoryEntry = riderHistory.find(s => s.stage_number == stageNumber);
            
            // Fetch the raw simulated stage data for results, GC, and jersey holders
            const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);

            if (!stageHistoryEntry || !simulatedStageData) {
                selectedStageDetails.innerHTML = `<p>Data for Stage ${stageNumber} not fully available.</p>`;
                return;
            }

            const { stage_results, gc_standings, jersey_holders } = simulatedStageData;
            const dailyRiderPoints = stageHistoryEntry.daily_rider_points;

            let detailsHtml = `<h3>Stage ${stageNumber} - ${stageHistoryEntry.date}</h3>`;

            // Top 3 Finishers (from stage_results)
            if (stage_results && stage_results.length > 0) {
                detailsHtml += `<h4>Top Finishers</h4>
                    <table>
                        <thead>
                            <tr><th>Rank</th><th>Rider</th><th>Time (if available)</th></tr>
                        </thead>
                        <tbody>`;
                stage_results.slice(0, 5).forEach(result => { // Show top 5 finishers from raw data
                    detailsHtml += `<tr><td>${result.rank}</td><td>${result.rider_name}</td><td>${result.time || 'N/A'}</td></tr>`;
                });
                detailsHtml += `</tbody></table>`;
            } else {
                detailsHtml += `<p>No stage results available.</p>`;
            }

            // Jersey Holders
            detailsHtml += `<h4>Jersey Holders</h4>
                <ul>
                    <li>Yellow Jersey: ${jersey_holders.yellow || 'N/A'}</li>
                    <li>Green Jersey: ${jersey_holders.green || 'N/A'}</li>
                    <li>Polka Dot Jersey: ${jersey_holders.polka_dot || 'N/A'}</li>
                    <li>White Jersey: ${jersey_holders.white || 'N/A'}</li>
                </ul>`;
            
            // Riders who scored points in this stage (top 10 based on our daily_rider_points calc)
            if (dailyRiderPoints) {
                const sortedDailyRiderPoints = Object.entries(dailyRiderPoints)
                    .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
                    .slice(0, 10); // Show top 10 riders by daily points

                detailsHtml += `<h4>Riders Earning Points This Stage</h4>
                    <table>
                        <thead>
                            <tr><th>Rider</th><th>Points Earned</th></tr>
                        </thead>
                        <tbody>`;
                sortedDailyRiderPoints.forEach(([rider, points]) => {
                    if (points > 0) { // Only show riders who actually earned points
                        detailsHtml += `<tr><td>${rider}</td><td>${points}</td></tr>`;
                    }
                });
                detailsHtml += `</tbody></table>`;
            } else {
                detailsHtml += `<p>No point-scoring riders data for this stage.</p>`;
            }

            selectedStageDetails.innerHTML = detailsHtml;
        }

        // Event listener for dropdown change
        stageSelect.addEventListener('change', (event) => {
            const selectedStageNum = event.target.value;
            if (selectedStageNum) {
                displayStageDetails(selectedStageNum);
            } else {
                selectedStageDetails.innerHTML = '<p>Select a stage to view its details, top finishers, and jersey holders.</p>';
            }
        });

        // Display details for the most recent stage by default
        if (riderHistory.length > 0) {
            const latestStageNum = riderHistory[riderHistory.length - 1].stage_number;
            stageSelect.value = latestStageNum; // Set dropdown to latest stage
            displayStageDetails(latestStageNum);
        }
    }


    // --- Fun Stats Page Functions (fun_stats.html) ---
    function renderFunStatsPage() {
        const funStatsContainer = document.getElementById('fun-stats-container');
        if (funStatsContainer) {
            funStatsContainer.innerHTML = '<p>This page will be filled with interesting statistics later!</p>';
        }
    }

    // --- Initialize Pages based on current HTML file ---
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path === '/Tour-de-France-Pool/') { // Handle root/index.html
        renderHomePage();
    } else if (path.includes('full_leaderboard.html')) {
        renderFullLeaderboardPage();
    } else if (path.includes('team_selection.html')) {
        renderTeamSelectionPage();
    } else if (path.includes('stages.html')) {
        renderStagesPage();
    } else if (path.includes('fun_stats.html')) {
        renderFunStatsPage();
    }
    // About page doesn't need specific JS rendering beyond static HTML
});