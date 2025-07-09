document.addEventListener('DOMContentLoaded', () => {
    // Common elements
    const lastUpdatedDateSpan = document.getElementById('last-updated-date');
    const DATA_PATH = './data/';

    // --- Helper Functions ---
    async function fetchData(filename) {
        try {
            const response = await fetch(DATA_PATH + filename);
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`File not found: ${filename}. This might be expected for some non-critical data.`);
                    return null; // Return null if file not found
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Could not fetch ${filename}:`, error);
            return null;
        }
    }

    function createTable(headers, data, rankKey = null) {
        if (!data || data.length === 0) {
            return '<p>Geen gegevens beschikbaar.</p>'; // Translated
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
        data.forEach((row) => {
            let rowClass = '';
            if (rankKey && row[rankKey]) {
                if (row[rankKey] === 1) rowClass = 'rank-1';
                else if (row[rankKey] === 2) rowClass = 'rank-2';
                else if (row[rankKey] === 3) rowClass = 'rank-3';
            }
            tableHTML += `<tr class="${rowClass}">`;
            // Map headers to data keys for dynamic content
            headers.forEach(header => {
                let displayValue;
                switch(header) {
                    case "Rang": displayValue = row.rank; break;
                    case "Deelnemer Naam": displayValue = row.participant_name; break;
                    case "Totaal Score": displayValue = row.total_score; break;
                    case "Dagelijkse Score": displayValue = row.daily_score; break;
                    case "Renner": displayValue = row.rider_name || row.rider; break; // 'rider' or 'rider_name'
                    case "Cumulatieve Punten": displayValue = row.cumulative_points; break;
                    case "Tijd (indien beschikbaar)": displayValue = row.time || 'N/A'; break;
                    case "Verdiende Punten": displayValue = row.points_earned || row.points; break; // 'points' or 'points_earned'
                    case "Team": displayValue = row.pro_team; break; // New for team selection
                    case "Type": displayValue = row.type; break; // New for team selection (Main/Reserve)
                    default: displayValue = 'N/A'; // Fallback
                }
                tableHTML += `<td>${displayValue !== undefined ? displayValue : 'N/A'}</td>`;
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
        const cumulativeLeaderboard = await fetchData('cumulative_leaderboard.json');

        if (!riderHistory || !leaderboardHistory || !cumulativeLeaderboard) {
            console.error('Niet alle benodigde gegevens konden worden geladen voor de startpagina.'); // Translated
            return;
        }

        // Get data for the most recent stage
        const latestRiderStageData = riderHistory[riderHistory.length - 1];
        const latestLeaderboardStageData = leaderboardHistory[leaderboardHistory.length - 1];
        
        if (!latestRiderStageData || !latestLeaderboardStageData) {
            console.warn('Geen etappegegevens beschikbaar.'); // Translated
            currentStageTitle.textContent = 'Nog geen etappegegevens beschikbaar.'; // Translated
            return;
        }

        const stageNumber = latestRiderStageData.stage_number;
        const updateDate = latestRiderStageData.date;
        lastUpdatedDateSpan.textContent = updateDate;

        // Render Current Stage Info
        currentStageTitle.textContent = `Meest Recente Etappe: Etappe ${stageNumber} (${updateDate})`; // Translated
        
        const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);
        if (simulatedStageData) {
            const stageResults = simulatedStageData.stage_results;
            const jerseyHolders = simulatedStageData.jersey_holders;

            // Top 3 Finishers
            if (stageResults && stageResults.length > 0) {
                topFinishersSpan.textContent = stageResults.slice(0, 3).map(entry => `${entry.rider_name} (${entry.rank}${entry.rank === 1 ? 'e' : 'e'} plek)`).join(', '); // Translated
            } else {
                topFinishersSpan.textContent = 'Nog geen resultaten beschikbaar.'; // Translated
            }

            // Jersey Holders
            yellowJerseySpan.textContent = jerseyHolders.yellow || 'N/A';
            greenJerseySpan.textContent = jerseyHolders.green || 'N/A';
            polkaDotJerseySpan.textContent = jerseyHolders.polka_dot || 'N/A';
            whiteJerseySpan.textContent = jerseyHolders.white || 'N/A';
        } else {
            topFinishersSpan.textContent = 'Gegevens niet beschikbaar.'; // Translated
            yellowJerseySpan.textContent = 'N/A (gegevens niet beschikbaar)'; // Translated
            greenJerseySpan.textContent = 'N/A (gegevens niet beschikbaar)'; // Translated
            polkaDotJerseySpan.textContent = 'N/A (gegevens niet beschikbaar)'; // Translated
            whiteJerseySpan.textContent = 'N/A (gegevens niet beschikbaar)'; // Translated
        }

        // Render Top 5 Daily Scorers (Participants)
        const dailyParticipantScores = latestLeaderboardStageData.daily_participant_scores;
        if (dailyParticipantScores) {
            const sortedDailyParticipants = Object.entries(dailyParticipantScores)
                .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                .map(([name, score]) => ({ participant_name: name, daily_score: score }))
                .slice(0, 5);

            const headers = ["Deelnemer Naam", "Dagelijkse Score"]; // Translated
            topDailyParticipantsDiv.innerHTML = createTable(headers, sortedDailyParticipants);
        } else {
            topDailyParticipantsDiv.innerHTML = '<p>Geen dagelijkse deelnemersscores beschikbaar voor deze etappe.</p>'; // Translated
        }

        // Render Top 5 Overall Standings (Participants)
        if (cumulativeLeaderboard) {
            const top5Cumulative = cumulativeLeaderboard.slice(0, 5);
            const headers = ["Rang", "Deelnemer Naam", "Totaal Score"]; // Translated
            topCumulativeParticipantsDiv.innerHTML = createTable(headers, top5Cumulative, 'rank');
        } else {
            topCumulativeParticipantsDiv.innerHTML = '<p>Geen algemeen klassement beschikbaar.</p>'; // Translated
        }
    }

    // --- Full Leaderboard Page Functions (full_leaderboard.html) ---
    async function renderFullLeaderboardPage() {
        const fullLeaderboardContainer = document.getElementById('full-leaderboard-container');
        if (fullLeaderboardContainer) {
            fullLeaderboardContainer.innerHTML = '<p>Volledig klassement laden...</p>'; // Translated
            const leaderboard = await fetchData('cumulative_leaderboard.json');

            if (leaderboard && leaderboard.length > 0) {
                const headers = ["Rang", "Deelnemer Naam", "Totaal Score"]; // Translated
                fullLeaderboardContainer.innerHTML = createTable(headers, leaderboard, 'rank');
            } else {
                fullLeaderboardContainer.innerHTML = '<p>Geen volledig klassement beschikbaar.</p>'; // Translated
            }
        }
    }

    // --- Team Selection Page Functions (team_selection.html) ---
    async function renderTeamSelectionPage() {
        const teamSelectionContainer = document.getElementById('team-selection-container');
        if (teamSelectionContainer) {
            teamSelectionContainer.innerHTML = '<p>Teamselecties laden...</p>'; // Translated
            
            // Fetch participant selections from the newly generated JSON file
            const participantSelectionsData = await fetchData('participant_selections.json');
            const cumulativeRiderPoints = await fetchData('cumulative_rider_points.json');

            if (!participantSelectionsData || !cumulativeRiderPoints) {
                teamSelectionContainer.innerHTML = '<p>Niet alle benodigde gegevens voor teamselecties konden worden geladen.</p>'; // Translated
                return;
            }

            let htmlContent = '';
            for (const participantName in participantSelectionsData) {
                const selectionDetails = participantSelectionsData[participantName];
                htmlContent += `<h3>${participantName}</h3>`;
                htmlContent += `
                    <table>
                        <thead>
                            <tr>
                                <th>Renner</th>
                                <th>Type</th>
                                <th>Team</th>
                                <th>Cumulatieve Punten</th>
                            </tr>
                        </thead>
                        <tbody>
                `; // Translated headers

                // Main Riders
                selectionDetails.main_riders.forEach(rider => {
                    const points = cumulativeRiderPoints[rider] || 0;
                    htmlContent += `
                        <tr>
                            <td>${rider}</td>
                            <td>Hoofdrenner</td>
                            <td>${selectionDetails.pro_team}</td>
                            <td>${points}</td>
                        </tr>
                    `; // Translated type
                });

                // Reserve Rider
                if (selectionDetails.reserve_rider) {
                    const points = cumulativeRiderPoints[selectionDetails.reserve_rider] || 0;
                    htmlContent += `
                        <tr>
                            <td>${selectionDetails.reserve_rider}</td>
                            <td>Reserve</td>
                            <td>${selectionDetails.pro_team}</td>
                            <td>${points}</td>
                        </tr>
                    `; // Translated type
                }

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
            stageSelect.innerHTML = '<option value="">Geen etappes beschikbaar</option>'; // Translated
            selectedStageDetails.innerHTML = '<p>Nog geen etappegegevens beschikbaar.</p>'; // Translated
            return;
        }

        // Populate dropdown with stages
        stageSelect.innerHTML = '<option value="">Selecteer een Etappe</option>'; // Translated
        riderHistory.forEach(stageData => {
            const option = document.createElement('option');
            option.value = stageData.stage_number;
            option.textContent = `Etappe ${stageData.stage_number} (${stageData.date})`; // Translated
            stageSelect.appendChild(option);
        });

        // Function to display details for a selected stage
        async function displayStageDetails(stageNumber) {
            selectedStageDetails.innerHTML = `<p>Details voor Etappe ${stageNumber} laden...</p>`; // Translated
            
            const stageHistoryEntry = riderHistory.find(s => s.stage_number == stageNumber);
            const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);

            if (!stageHistoryEntry || !simulatedStageData) {
                selectedStageDetails.innerHTML = `<p>Gegevens voor Etappe ${stageNumber} niet volledig beschikbaar.</p>`; // Translated
                return;
            }

            const { stage_results, gc_standings, jersey_holders } = simulatedStageData;
            const dailyRiderPoints = stageHistoryEntry.daily_rider_points;

            let detailsHtml = `<h3>Etappe ${stageNumber} - ${stageHistoryEntry.date}</h3>`;

            // Top Finishers (from stage_results)
            if (stage_results && stage_results.length > 0) {
                detailsHtml += `<h4>Top Aankomsten</h4>
                    <table>
                        <thead>
                            <tr><th>Rang</th><th>Renner</th><th>Tijd (indien beschikbaar)</th></tr>
                        </thead>
                        <tbody>`; // Translated
                stage_results.slice(0, 5).forEach(result => { // Show top 5 finishers from raw data
                    detailsHtml += `<tr><td>${result.rank}</td><td>${result.rider_name}</td><td>${result.time || 'N/A'}</td></tr>`;
                });
                detailsHtml += `</tbody></table>`;
            } else {
                detailsHtml += `<p>Nog geen etapperesultaten beschikbaar.</p>`; // Translated
            }

            // Jersey Holders
            detailsHtml += `<h4>Truidragers</h4>
                <ul>
                    <li>Gele Trui: ${jersey_holders.yellow || 'N/A'}</li>
                    <li>Groene Trui: ${jersey_holders.green || 'N/A'}</li>
                    <li>Bolletjestrui: ${jersey_holders.polka_dot || 'N/A'}</li>
                    <li>Witte Trui: ${jersey_holders.white || 'N/A'}</li>
                </ul>`; // Translated
            
            // Riders who scored points in this stage (top 10 based on our daily_rider_points calc)
            if (dailyRiderPoints) {
                const sortedDailyRiderPoints = Object.entries(dailyRiderPoints)
                    .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
                    .slice(0, 10); // Show top 10 riders by daily points

                detailsHtml += `<h4>Renners met Punten in Deze Etappe</h4>
                    <table>
                        <thead>
                            <tr><th>Renner</th><th>Verdiende Punten</th></tr>
                        </thead>
                        <tbody>`; // Translated
                sortedDailyRiderPoints.forEach(([rider, points]) => {
                    if (points > 0) { // Only show riders who actually earned points
                        detailsHtml += `<tr><td>${rider}</td><td>${points}</td></tr>`;
                    }
                });
                detailsHtml += `</tbody></table>`;
            } else {
                detailsHtml += `<p>Geen puntenscorende rennersgegevens voor deze etappe.</p>`; // Translated
            }

            selectedStageDetails.innerHTML = detailsHtml;
        }

        // Event listener for dropdown change
        stageSelect.addEventListener('change', (event) => {
            const selectedStageNum = event.target.value;
            if (selectedStageNum) {
                displayStageDetails(selectedStageNum);
            } else {
                selectedStageDetails.innerHTML = '<p>Selecteer een etappe om de details, top aankomsten en truidragers te bekijken.</p>'; // Translated
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
            funStatsContainer.innerHTML = '<p>Deze pagina wordt later gevuld met interessante statistieken!</p>'; // Translated
        }
    }

    // --- Initialize Pages based on current HTML file ---
    const path = window.location.pathname;
    // Check for exact path or variations (e.g., / or /index.html)
    if (path.includes('index.html') || path === '/' || path.endsWith('/Tour-de-France-Pool/') || path.endsWith('/docs/')) {
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
});