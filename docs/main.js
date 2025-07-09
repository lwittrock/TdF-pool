document.addEventListener('DOMContentLoaded', () => {
    // Common elements
    const lastUpdatedDateSpan = document.getElementById('last-updated-date');
    const DATA_PATH = './data/';

    // --- Global Variables for Team Selection Page ---
    // These will store data once fetched to avoid refetching on every search/click
    let globalParticipantSelectionsData = null;
    let globalCumulativeRiderPoints = null;
    let globalAllParticipantNames = []; // Stores all participant names

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
        const startLocationSpan = document.getElementById('start-location');
        const finishLocationSpan = document.getElementById('finish-location');
        const distanceKmSpan = document.getElementById('distance-km');
        const stageTypeSpan = document.getElementById('stage-type');
        const topFinishersSpan = document.getElementById('top-finishers');
        const yellowJerseySpan = document.getElementById('yellow-jersey');
        const greenJerseySpan = document.getElementById('green-jersey');
        const polkaDotJerseySpan = document.getElementById('polka-dot-jersey');
        const whiteJerseySpan = document.getElementById('white-jersey');
        const notableDropoutSpan = document.getElementById('notable-dropout'); // Added notable dropout
        const topDailyParticipantsDiv = document.getElementById('top-daily-participants');
        const topCumulativeParticipantsDiv = document.getElementById('top-cumulative-participants');

        // Fetch all necessary data for the home page
        const riderHistory = await fetchData('rider_points_history.json');
        const leaderboardHistory = await fetchData('leaderboard_history.json');
        const cumulativeLeaderboard = await fetchData('cumulative_leaderboard.json');

        if (!riderHistory || !leaderboardHistory || !cumulativeLeaderboard) {
            console.error('Niet alle benodigde gegevens konden worden geladen voor de startpagina.'); // Translated
            // Set all spans to indicate loading failure
            [currentStageTitle, startLocationSpan, finishLocationSpan, distanceKmSpan, stageTypeSpan,
             topFinishersSpan, yellowJerseySpan, greenJerseySpan, polkaDotJerseySpan, whiteJerseySpan,
             notableDropoutSpan].forEach(span => {
                if (span) span.textContent = 'Gegevens laden mislukt.'; // Translated
            });
            if (topDailyParticipantsDiv) topDailyParticipantsDiv.innerHTML = '<p>Gegevens laden mislukt.</p>';
            if (topCumulativeParticipantsDiv) topCumulativeParticipantsDiv.innerHTML = '<p>Gegevens laden mislukt.</p>';
            return;
        }

        // Get data for the most recent stage
        const latestRiderStageData = riderHistory[riderHistory.length - 1];
        const latestLeaderboardStageData = leaderboardHistory[leaderboardHistory.length - 1];
        
        if (!latestRiderStageData || !latestLeaderboardStageData) {
            console.warn('Geen etappegegevens beschikbaar in geschiedenisbestanden.'); // Translated
            currentStageTitle.textContent = 'Nog geen etappegegevens beschikbaar.'; // Translated
            // Clear other stage-specific spans
            [startLocationSpan, finishLocationSpan, distanceKmSpan, stageTypeSpan,
             topFinishersSpan, yellowJerseySpan, greenJerseySpan, polkaDotJerseySpan, whiteJerseySpan,
             notableDropoutSpan].forEach(span => {
                if (span) span.textContent = 'N/A';
            });
            if (topDailyParticipantsDiv) topDailyParticipantsDiv.innerHTML = '<p>Geen dagelijkse deelnemersscores beschikbaar.</p>';
            if (topCumulativeParticipantsDiv) topCumulativeParticipantsDiv.innerHTML = '<p>Geen algemeen klassement beschikbaar.</p>';
            return;
        }

        const stageNumber = latestRiderStageData.stage_number;
        const updateDate = latestRiderStageData.date;
        lastUpdatedDateSpan.textContent = updateDate;

        // Render Current Stage Info
        currentStageTitle.textContent = `Meest Recente Etappe: Etappe ${stageNumber} (${updateDate})`; // Translated
        
        // Fetch specific stage details from simulated_stages folder
        const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);
        
        if (simulatedStageData) {
            // Stage Overview Details
            startLocationSpan.textContent = simulatedStageData.start_location || 'Onbekend'; // Translated
            finishLocationSpan.textContent = simulatedStageData.finish_location || 'Onbekend'; // Translated
            distanceKmSpan.textContent = simulatedStageData.distance_km ? `${simulatedStageData.distance_km}` : 'Onbekend'; // Translated
            stageTypeSpan.textContent = simulatedStageData.stage_type || 'Onbekend'; // Translated

            // Stage Results Summary
            const stageResults = simulatedStageData.stage_results;
            const jerseyHolders = simulatedStageData.jersey_holders;

            // Top 3 Finishers
            if (stageResults && stageResults.length > 0) {
                topFinishersSpan.textContent = stageResults.slice(0, 3).map(entry => `${entry.rider_name} (${entry.rank}${entry.rank === 1 ? 'e' : 'e'} plek)`).join(', '); // Translated
            } else {
                topFinishersSpan.textContent = 'Nog geen resultaten beschikbaar.'; // Translated
            }

            // Jersey Holders (ensure proper N/A if not available)
            yellowJerseySpan.textContent = jerseyHolders.yellow || 'N/A';
            greenJerseySpan.textContent = jerseyHolders.green || 'N/A';
            polkaDotJerseySpan.textContent = jerseyHolders.polka_dot || 'N/A';
            whiteJerseySpan.textContent = jerseyHolders.white || 'N/A';
            // Notable Dropout is still a placeholder
            notableDropoutSpan.textContent = '(Nog niet geïmplementeerd)';

        } else {
            // Fallback if simulatedStageData itself is not found
            console.warn(`Simulatiegegevens voor Etappe ${stageNumber} niet gevonden.`); // Translated
            [startLocationSpan, finishLocationSpan, distanceKmSpan, stageTypeSpan,
             topFinishersSpan, yellowJerseySpan, greenJerseySpan, polkaDotJerseySpan, whiteJerseySpan,
             notableDropoutSpan].forEach(span => {
                if (span) span.textContent = 'Gegevens niet beschikbaar.'; // Translated
            });
        }

        // Render Top 5 Daily Scorers (Participants)
        const dailyParticipantScores = latestLeaderboardStageData.daily_participant_scores;
        if (dailyParticipantScores && Object.keys(dailyParticipantScores).length > 0) {
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
        if (cumulativeLeaderboard && cumulativeLeaderboard.length > 0) {
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
    async function displayParticipantTeam(participantName) { // Removed data params as they are global now
        const selectedParticipantDetails = document.getElementById('selected-participant-details');
        selectedParticipantDetails.innerHTML = ''; // Clear previous content

        if (!participantName) {
            selectedParticipantDetails.innerHTML = '<p>Selecteer een deelnemer om de teamselectie te bekijken.</p>';
            return;
        }

        const selectionDetails = globalParticipantSelectionsData[participantName];
        if (!selectionDetails) {
            selectedParticipantDetails.innerHTML = `<p>Geen selectiegegevens gevonden voor ${participantName}.</p>`;
            return;
        }

        let htmlContent = `<h3>Teamselectie van ${participantName}</h3>`;
        // Display the chosen professional team prominently
        htmlContent += `<p><strong>Gekozen Team:</strong> ${selectionDetails.pro_team || 'N/A'}</p>`;

        htmlContent += `
            <table>
                <thead>
                    <tr>
                        <th>Renner</th>
                        <th>Cumulatieve Punten</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let totalCumulativePoints = 0;

        // Main Riders
        selectionDetails.main_riders.forEach(rider => {
            const points = globalCumulativeRiderPoints[rider] || 0;
            totalCumulativePoints += points; // Sum points for main riders
            htmlContent += `
                <tr>
                    <td>${rider}</td>
                    <td>${points}</td>
                </tr>
            `;
        });

        // Reserve Rider (with visual distinction)
        if (selectionDetails.reserve_rider) {
            const reservePoints = globalCumulativeRiderPoints[selectionDetails.reserve_rider] || 0;
            htmlContent += `
                <tr class="reserve-rider">
                    <td>${selectionDetails.reserve_rider} (Reserve)</td>
                    <td>${reservePoints}</td>
                </tr>
            `;
        }

        htmlContent += `
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td><strong>Totaal Punten (Hoofdrenners)</strong></td>
                        <td><strong>${totalCumulativePoints}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
        selectedParticipantDetails.innerHTML = htmlContent;
    }


    // New helper function to render the list of participants
    function renderParticipantList(namesToDisplay) {
        const allParticipantsListDiv = document.getElementById('all-participants-list');
        allParticipantsListDiv.innerHTML = ''; // Clear existing list

        if (namesToDisplay.length === 0) {
            allParticipantsListDiv.innerHTML = '<p class="no-results">Geen deelnemers gevonden die overeenkomen met de zoekterm.</p>';
            return;
        }

        namesToDisplay.forEach(name => {
            const participantItem = document.createElement('div');
            participantItem.classList.add('participant-item');
            participantItem.textContent = name;
            participantItem.addEventListener('click', () => {
                // Set the search bar value to the clicked name (optional, but good for clarity)
                document.getElementById('participant-search').value = name;
                // Display details for the clicked participant
                displayParticipantTeam(name); // Now uses global data
                // Optional: Scroll to the top of the team details section
                document.getElementById('selected-participant-details').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            allParticipantsListDiv.appendChild(participantItem);
        });
    }


    async function renderTeamSelectionPage() {
        const participantSearchInput = document.getElementById('participant-search');
        const allParticipantsListDiv = document.getElementById('all-participants-list');
        const selectedParticipantDetails = document.getElementById('selected-participant-details');

        allParticipantsListDiv.innerHTML = '<p>Deelnemers laden...</p>'; // Initial loading message

        // Fetch data and store globally
        globalParticipantSelectionsData = await fetchData('participant_selections.json');
        globalCumulativeRiderPoints = await fetchData('cumulative_rider_points.json');

        if (!globalParticipantSelectionsData || !globalCumulativeRiderPoints || Object.keys(globalParticipantSelectionsData).length === 0) {
            participantSearchInput.placeholder = 'Geen deelnemers beschikbaar';
            participantSearchInput.disabled = true;
            allParticipantsListDiv.innerHTML = '<p>Niet alle benodigde gegevens voor teamselecties konden worden geladen of er zijn geen deelnemers.</p>';
            selectedParticipantDetails.innerHTML = ''; // Clear any previous default text
            return;
        }

        globalAllParticipantNames = Object.keys(globalParticipantSelectionsData).sort();

        // Initially display ALL participants
        renderParticipantList(globalAllParticipantNames);
        selectedParticipantDetails.innerHTML = '<p>Selecteer een deelnemer uit de lijst om de teamselectie te bekijken.</p>';


        // Add event listener for search input
        participantSearchInput.addEventListener('input', () => {
            const searchTerm = participantSearchInput.value.toLowerCase();
            
            const filteredNames = globalAllParticipantNames.filter(name =>
                name.toLowerCase().includes(searchTerm)
            );
            renderParticipantList(filteredNames);
        });
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
            // Fetch the full simulated stage data for details
            const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);

            if (!stageHistoryEntry || !simulatedStageData) {
                selectedStageDetails.innerHTML = `<p>Gegevens voor Etappe ${stageNumber} niet volledig beschikbaar.</p>`; // Translated
                return;
            }

            const { stage_results, gc_standings, jersey_holders, start_location, finish_location, distance_km, stage_type } = simulatedStageData;
            const dailyRiderPoints = stageHistoryEntry.daily_rider_points;

            let detailsHtml = `<h3>Etappe ${stageNumber} - ${stageHistoryEntry.date}</h3>`;

            // New: Detailed Stage Overview
            detailsHtml += `
                <h4>Etappe Overzicht</h4>
                <p><strong>Start:</strong> ${start_location || 'Onbekend'}</p>
                <p><strong>Finish:</strong> ${finish_location || 'Onbekend'}</p>
                <p><strong>Afstand:</strong> ${distance_km ? `${distance_km} km` : 'Onbekend'}</p>
                <p><strong>Type:</strong> ${stage_type || 'Onbekend'}</p>
            `; // Translated

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
            if (dailyRiderPoints && Object.keys(dailyRiderPoints).length > 0) {
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
                detailsHtml += `<p>Geen puntenscorende rennersgegevens voor deze etappe.</p Huber</p>`; // Translated
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
        renderTeamSelectionPage(); // <-- Ensure this is called here
    } else if (path.includes('stages.html')) {
        renderStagesPage();
    } else if (path.includes('fun_stats.html')) {
        renderFunStatsPage();
    }
});