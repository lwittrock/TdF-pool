document.addEventListener('DOMContentLoaded', () => {
    // Common elements
    const lastUpdatedDateSpan = document.getElementById('last-updated-date');
    const DATA_PATH = './data/';

    // --- Global Variables for Team Selection Page ---
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

    // Retain createTable for pages that still use traditional tables (e.g., full leaderboard, team selection)
    function createTable(headers, data, rankKey = null) {
        if (!data || data.length === 0) {
            return '<p>Geen gegevens beschikbaar.</p>';
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
                    case "Renner": displayValue = row.rider_name || row.rider; break;
                    case "Cumulatieve Punten": displayValue = row.cumulative_points; break;
                    case "Tijd (indien beschikbaar)": displayValue = row.time || 'N/A'; break;
                    case "Verdiende Punten": displayValue = row.points_earned || row.points; break;
                    default: displayValue = 'N/A';
                }
                tableHTML += `<td>${displayValue !== undefined ? displayValue : 'N/A'}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        return tableHTML;
    }

    // Helper function to create a table (modified for leaderboard)
    function createLeaderboardTable(headers, data, leaderboardHistory, primarySortKey) {
        if (!data || data.length === 0) {
            return '<p>Geen data om weer te geven.</p>';
        }

        // Remove the last header (which was for the button)
        const displayHeaders = headers.slice(0, -1); // Exclude the last empty header

        let tableHTML = '<table class="leaderboard-table">';
        tableHTML += '<thead><tr>';
        displayHeaders.forEach(header => { // Use displayHeaders here
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead>';
        tableHTML += '<tbody>';

        data.forEach((item, index) => {
            const participantName = item['participant_name'];
            const totalScore = item['total_score'];
            const rank = item[primarySortKey];
            const rankChange = item['rank_change'];

            let rankChangeIndicator = '';
            if (rankChange !== null && rankChange !== undefined) {
                if (rankChange > 0) {
                    rankChangeIndicator = `<span class="rank-up" title="Stijging van ${rankChange} plaatsen">↑${rankChange}</span>`;
                } else if (rankChange < 0) {
                    rankChangeIndicator = `<span class="rank-down" title="Daling van ${Math.abs(rankChange)} plaatsen">↓${Math.abs(rankChange)}</span>`;
                } else {
                    rankChangeIndicator = `<span class="rank-no-change" title="Geen verandering">=</span>`;
                }
            }

            // Main participant row - now clickable!
            tableHTML += `<tr class="leaderboard-row clickable" data-participant-name="${participantName}" data-details-id="details-${index}" aria-expanded="false" aria-controls="details-${index}">`;
            tableHTML += `<td>${rank} ${rankChangeIndicator}</td>`;
            tableHTML += `<td>${participantName}</td>`;
            tableHTML += `<td class="total-score-cell"><span class="total-score-value">${totalScore}</span></td>`;
            // Removed the button column
            tableHTML += '</tr>';

            // Hidden row for detailed stage points
            tableHTML += `<tr class="details-row hidden" id="details-${index}">`;
            // Colspan will need to be `headers.length - 1` because we removed one column
            tableHTML += `<td colspan="${headers.length - 1}">`;
            tableHTML += `<div class="stage-details-content"></div>`; // Content will be loaded here
            tableHTML += `</td>`;
            tableHTML += `</tr>`;
        });

        tableHTML += '</tbody></table>';

        // After the table is rendered, attach event listeners
        setTimeout(() => {
            document.querySelectorAll('.leaderboard-row.clickable').forEach(row => {
                row.addEventListener('click', (event) => {
                    const clickedRow = event.currentTarget; // The main participant row
                    const participantName = clickedRow.dataset.participantName;
                    const detailsRowId = clickedRow.dataset.detailsId;
                    const detailsRow = document.getElementById(detailsRowId);
                    const detailsContentDiv = detailsRow.querySelector('.stage-details-content');

                    if (detailsRow.classList.contains('hidden')) {
                        // Expand
                        clickedRow.setAttribute('aria-expanded', 'true');
                        detailsRow.classList.remove('hidden');
                        detailsRow.style.display = 'table-row'; // Ensure it displays as a table row

                        // Generate and load stage points
                        detailsContentDiv.innerHTML = generateStagePointsHTML(participantName, leaderboardHistory);
                    } else {
                        // Collapse
                        clickedRow.setAttribute('aria-expanded', 'false');
                        detailsRow.classList.add('hidden');
                        detailsRow.style.display = 'none'; // Hide it
                        detailsContentDiv.innerHTML = ''; // Clear content when collapsed
                    }
                });
            });
        }, 0); // Execute after the current call stack clears

        return tableHTML;
    }

// generateStagePointsHTML remains the same as previously provided

    // New helper function to generate the HTML for stage points
    function generateStagePointsHTML(participantName, leaderboardHistory) {
        let stagePointsHTML = '<h4>Punten per Etappe:</h4><ul class="stage-points-list">';

        if (!leaderboardHistory || leaderboardHistory.length === 0) {
            return '<p>Geen gedetailleerde etappegegevens beschikbaar.</p>';
        }

        // Filter history to only include stages where the participant earned points or if all stages should be shown
        // We'll iterate through all stages to show "0" for stages without points.
        leaderboardHistory.forEach(stageEntry => {
            const stageNumber = stageEntry.stage_number;
            const dailyScores = stageEntry.daily_participant_scores || {};
            const pointsForThisStage = dailyScores[participantName] || 0; // Get points, default to 0 if not found

            stagePointsHTML += `<li>Etappe ${stageNumber}: <span class="stage-point-value">${pointsForThisStage}</span> punten</li>`;
        });

        stagePointsHTML += '</ul>';
        return stagePointsHTML;
    }    

    // NEW: Function to create the modern participant list
    function createParticipantList(data, isCumulative = false, previousLeaderboard = null) {
        if (!data || data.length === 0) {
            return '<p>Geen gegevens beschikbaar.</p>';
        }

        let listHTML = '';
        data.forEach((item, index) => {
            const rank = isCumulative ? item.rank : (index + 1);
            let itemClass = 'participant-item';
            if (rank === 1) itemClass += ' rank-1';
            else if (rank === 2) itemClass += ' rank-2';
            else if (rank === 3) itemClass += ' rank-3';

            const name = item.participant_name;
            const score = isCumulative ? item.total_score : item.daily_score;

            // Add spots gained/lost logic for cumulative leaderboard
            let rankChangeIcon = '';
            if (isCumulative && previousLeaderboard) {
                const prevRank = previousLeaderboard.find(prevItem => prevItem.participant_name === name)?.rank;
                if (prevRank) {
                    if (prevRank > rank) { // Gained spots
                        rankChangeIcon = `<i class="fas fa-caret-up score-change-icon up"></i> ${prevRank - rank}`;
                    } else if (prevRank < rank) { // Lost spots
                        rankChangeIcon = `<i class="fas fa-caret-down score-change-icon down"></i> ${rank - prevRank}`;
                    } else { // No change
                        rankChangeIcon = `<i class="fas fa-equals score-change-icon no-change"></i>`;
                    }
                }
            }

            listHTML += `
                <div class="${itemClass}">
                    <span class="participant-name">${isCumulative ? `<span class="rank-number">${rank}.</span> ` : ''}${name}</span>
                    <span class="participant-score">${score} punten ${rankChangeIcon}</span>
                </div>
            `;
        });
        return listHTML;
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
        const notableDropoutSpan = document.getElementById('notable-dropout');
        const topDailyParticipantsDiv = document.getElementById('top-daily-participants');
        const topCumulativeParticipantsDiv = document.getElementById('top-cumulative-participants');
        const finisher1Span = document.getElementById('finisher-1');
        const finisher2Span = document.getElementById('finisher-2');
        const finisher3Span = document.getElementById('finisher-3');

        // Fetch all necessary data for the home page
        const riderHistory = await fetchData('rider_points_history.json');
        const leaderboardHistory = await fetchData('leaderboard_history.json');
        const cumulativeLeaderboard = await fetchData('cumulative_leaderboard.json');

        // NEW: Fetch previous leaderboard for rank changes
        let previousCumulativeLeaderboard = null;
        if (leaderboardHistory && leaderboardHistory.length > 1) {
            // Get the second to last entry for previous standings
            const prevStageData = leaderboardHistory[leaderboardHistory.length - 2];
            if (prevStageData && prevStageData.cumulative_participant_scores) {
                // Convert prev cumulative scores to an array of objects with rank for comparison
                previousCumulativeLeaderboard = Object.entries(prevStageData.cumulative_participant_scores)
                    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA) // Sort to determine rank
                    .map(([name, score], index) => ({ participant_name: name, total_score: score, rank: index + 1 }));
            }
        }


        if (!riderHistory || !leaderboardHistory || !cumulativeLeaderboard) {
            console.error('Niet alle benodigde gegevens konden worden geladen voor de startpagina.');
            [currentStageTitle, startLocationSpan, finishLocationSpan, distanceKmSpan, stageTypeSpan,
             topFinishersSpan, yellowJerseySpan, greenJerseySpan, polkaDotJerseySpan, whiteJerseySpan,
             notableDropoutSpan].forEach(span => {
                 if (span) span.textContent = 'Gegevens laden mislukt.';
             });
            if (topDailyParticipantsDiv) topDailyParticipantsDiv.innerHTML = '<p>Gegevens laden mislukt.</p>';
            if (topCumulativeParticipantsDiv) topCumulativeParticipantsDiv.innerHTML = '<p>Gegevens laden mislukt.</p>';
            return;
        }

        const latestRiderStageData = riderHistory[riderHistory.length - 1];
        const latestLeaderboardStageData = leaderboardHistory[leaderboardHistory.length - 1];

        if (!latestRiderStageData || !latestLeaderboardStageData) {
            console.warn('Geen etappegegevens beschikbaar in geschiedenisbestanden.');
            currentStageTitle.textContent = 'Nog geen etappegegevens beschikbaar.';
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
        const updateDate = latestRiderStageData.date; // Fixed typo: rulerStageData -> riderStageData
        lastUpdatedDateSpan.textContent = updateDate;

        // Render Current Stage Info
        currentStageTitle.textContent = `Meest Recente Etappe: Etappe ${stageNumber} (${updateDate})`;

        const simulatedStageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);

        if (simulatedStageData) {
            // Stage Overview Details
            startLocationSpan.textContent = simulatedStageData.start_location || 'Onbekend';
            finishLocationSpan.textContent = simulatedStageData.finish_location || 'Onbekend';
            distanceKmSpan.textContent = simulatedStageData.distance_km ? `${simulatedStageData.distance_km}` : 'Onbekend';
            stageTypeSpan.textContent = simulatedStageData.stage_type || 'Onbekend';

            // Stage Results Summary
            const stageResults = simulatedStageData.stage_results;
            const jerseyHolders = simulatedStageData.jersey_holders;

            // Top 3 Finishers
            if (stageResults && stageResults.length > 0) {
                if (finisher1Span) finisher1Span.textContent = stageResults[0]?.rider_name || '-';
                if (finisher2Span) finisher2Span.textContent = stageResults[1]?.rider_name || '-';
                if (finisher3Span) finisher3Span.textContent = stageResults[2]?.rider_name || '-';
            } else {
                if (finisher1Span) finisher1Span.textContent = '-';
                if (finisher2Span) finisher2Span.textContent = '-';
                if (finisher3Span) finisher3Span.textContent = '-';
            }

            // Jersey Holders
            yellowJerseySpan.textContent = jerseyHolders.yellow || 'N/A';
            greenJerseySpan.textContent = jerseyHolders.green || 'N/A';
            polkaDotJerseySpan.textContent = jerseyHolders.polka_dot || 'N/A';
            whiteJerseySpan.textContent = jerseyHolders.white || 'N/A';

        } else {
            console.warn(`Simulatiegegevens voor Etappe ${stageNumber} niet gevonden.`);
            [startLocationSpan, finishLocationSpan, distanceKmSpan, stageTypeSpan,
             topFinishersSpan, yellowJerseySpan, greenJerseySpan, polkaDotJerseySpan, whiteJerseySpan,
             notableDropoutSpan].forEach(span => {
                 if (span) span.textContent = 'Gegevens niet beschikbaar.';
             });
        }

        // Render Top 5 Daily Scorers (Participants) using the new function
        const dailyParticipantScores = latestLeaderboardStageData.daily_participant_scores;
        if (dailyParticipantScores && Object.keys(dailyParticipantScores).length > 0) {
            const sortedDailyParticipants = Object.entries(dailyParticipantScores)
                .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                .map(([name, score]) => ({ participant_name: name, daily_score: score }))
                .slice(0, 5);
            topDailyParticipantsDiv.innerHTML = createParticipantList(sortedDailyParticipants, false);
        } else {
            topDailyParticipantsDiv.innerHTML = '<p>Geen dagelijkse deelnemersscores beschikbaar voor deze etappe.</p>';
        }

        console.log('dailyParticipantScores:', dailyParticipantScores);
        console.log('latestLeaderboardStageData:', latestLeaderboardStageData);

        // Render Top 5 Overall Standings (Participants) using the new function
        if (cumulativeLeaderboard && cumulativeLeaderboard.length > 0) {
            const top5Cumulative = cumulativeLeaderboard.slice(0, 5);
            topCumulativeParticipantsDiv.innerHTML = createParticipantList(top5Cumulative, true, previousCumulativeLeaderboard);
        } else {
            topCumulativeParticipantsDiv.innerHTML = '<p>Geen algemeen klassement beschikbaar.</p>';
        }
    }

    // --- Full Leaderboard Page Functions (full_leaderboard.html) ---
    async function renderFullLeaderboardPage() {
        const fullLeaderboardContainer = document.getElementById('full-leaderboard-container');
        if (fullLeaderboardContainer) {
            fullLeaderboardContainer.innerHTML = '<p>Volledig klassement laden...</p>';

            try {
                // Fetch both the cumulative leaderboard and the history
                const [leaderboard, leaderboardHistory] = await Promise.all([
                    fetchData('cumulative_leaderboard.json'),
                    fetchData('leaderboard_history.json')
                ]);

                if (leaderboard && leaderboard.length > 0) {
                    const headers = ["Rang", "Deelnemer Naam", "Totaal Score", ""]; // Add an empty header for the expand/collapse icon

                    // Pass the leaderboardHistory to createTable
                    fullLeaderboardContainer.innerHTML = createLeaderboardTable(headers, leaderboard, leaderboardHistory, 'rank');
                } else {
                    fullLeaderboardContainer.innerHTML = '<p>Geen volledig klassement beschikbaar.</p>';
                }
            } catch (error) {
                console.error('Error loading full leaderboard data:', error);
                fullLeaderboardContainer.innerHTML = '<p>Fout bij het laden van het klassement. Probeer later opnieuw.</p>';
            }
        }
    }

    // --- Team Selection Page Functions (team_selection.html) ---
    async function displayParticipantTeam(participantName) {
        const selectedParticipantDetails = document.getElementById('selected-participant-details');
        selectedParticipantDetails.innerHTML = '';

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

        selectionDetails.main_riders.forEach(rider => {
            const points = globalCumulativeRiderPoints[rider] || 0;
            totalCumulativePoints += points;
            htmlContent += `
                <tr>
                    <td>${rider}</td>
                    <td>${points}</td>
                </tr>
            `;
        });

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


    function renderParticipantList(namesToDisplay) { // This function is for the search results, not the main page lists
        const allParticipantsListDiv = document.getElementById('all-participants-list');
        allParticipantsListDiv.innerHTML = '';

        if (namesToDisplay.length === 0) {
            allParticipantsListDiv.innerHTML = '<p class="no-results">Geen deelnemers gevonden die overeenkomen met de zoekterm.</p>';
            return;
        }

        namesToDisplay.forEach(name => {
            const participantItem = document.createElement('div');
            participantItem.classList.add('participant-item'); // Reuse the participant-item class for styling
            participantItem.textContent = name;
            participantItem.addEventListener('click', () => {
                document.getElementById('participant-search').value = name;
                displayParticipantTeam(name);
                document.getElementById('selected-participant-details').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            allParticipantsListDiv.appendChild(participantItem);
        });
    }


    async function renderTeamSelectionPage() {
        const participantSearchInput = document.getElementById('participant-search');
        const allParticipantsListDiv = document.getElementById('all-participants-list');
        const selectedParticipantDetails = document.getElementById('selected-participant-details');

        allParticipantsListDiv.innerHTML = '<p>Deelnemers laden...</p>';

        globalParticipantSelectionsData = await fetchData('participant_selections.json');
        globalCumulativeRiderPoints = await fetchData('cumulative_rider_points.json');

        if (!globalParticipantSelectionsData || !globalCumulativeRiderPoints || Object.keys(globalParticipantSelectionsData).length === 0) {
            participantSearchInput.placeholder = 'Geen deelnemers beschikbaar';
            participantSearchInput.disabled = true;
            allParticipantsListDiv.innerHTML = '<p>Niet alle benodigde gegevens voor teamselecties konden worden geladen of er zijn geen deelnemers.</p>';
            selectedParticipantDetails.innerHTML = '';
            return;
        }

        globalAllParticipantNames = Object.keys(globalParticipantSelectionsData).sort(); // Sort names alphabetically
        renderParticipantList(globalAllParticipantNames); // Initial render of all participants

        // Event listener for search input
        if (participantSearchInput) {
            participantSearchInput.addEventListener('input', (event) => {
                const searchTerm = event.target.value.toLowerCase();
                const filteredNames = globalAllParticipantNames.filter(name =>
                    name.toLowerCase().includes(searchTerm)
                );
                renderParticipantList(filteredNames);
            });
        }

        // Initialize with no selection shown, prompt user to select
        selectedParticipantDetails.innerHTML = '<p>Selecteer een deelnemer uit de lijst hierboven om hun team te bekijken.</p>';
    }

    // --- Stages Page Functions (stages.html) ---
    async function renderStagesPage() {
        const stageSelect = document.getElementById('stage-select');
        const selectedStageDetailsDiv = document.getElementById('selected-stage-details');

        if (!stageSelect || !selectedStageDetailsDiv) return; // Exit if not on the stages page

        const totalStages = 21; // Assuming 21 stages for Tour de France 2025
        for (let i = 1; i <= totalStages; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Etappe ${i}`;
            stageSelect.appendChild(option);
        }

        stageSelect.addEventListener('change', async (event) => {
            const stageNumber = event.target.value;
            if (stageNumber) {
                selectedStageDetailsDiv.innerHTML = `<p>Gegevens voor Etappe ${stageNumber} laden...</p>`;
                const stageData = await fetchData(`simulated_stages/stage_${stageNumber}_data.json`);

                if (stageData) {
                    let html = `<h3>Etappe ${stageNumber}: ${stageData.start_location} naar ${stageData.finish_location}</h3>`;
                    html += `<p><strong>Afstand:</strong> ${stageData.distance_km} km</p>`;
                    html += `<p><strong>Type:</strong> ${stageData.stage_type}</p>`;
                    html += `<h4>Top 5 Aankomsten</h4>`;
                    if (stageData.stage_results && stageData.stage_results.length > 0) {
                        const top5Results = stageData.stage_results.slice(0, 5).map(result => ({
                            rank: result.rank,
                            rider: result.rider_name,
                            time: result.time || 'N/A',
                            points_earned: result.points
                        }));
                        const headers = ["Rang", "Renner", "Tijd (indien beschikbaar)", "Verdiende Punten"];
                        html += createTable(headers, top5Results, 'rank');
                    } else {
                        html += '<p>Nog geen resultaten beschikbaar voor deze etappe.</p>';
                    }

                    // Display jersey holders for the selected stage
                    html += `<h4>Trui Dragers na deze Etappe</h4>`;
                    html += `<ul>
                                <li><span class="jersey-icon yellow"></span> Gele Trui: ${stageData.jersey_holders.yellow || 'N/A'}</li>
                                <li><span class="jersey-icon green"></span> Groene Trui: ${stageData.jersey_holders.green || 'N/A'}</li>
                                <li><span class="jersey-icon polka-dot"></span> Bolletjestrui: ${stageData.jersey_holders.polka_dot || 'N/A'}</li>
                                <li><span class="jersey-icon white"></span> Witte Trui: ${stageData.jersey_holders.white || 'N/A'}</li>
                            </ul>`;

                } else {
                    html = `<p>Geen gegevens gevonden voor Etappe ${stageNumber}.</p>`;
                }
                selectedStageDetailsDiv.innerHTML = html;
            } else {
                selectedStageDetailsDiv.innerHTML = '<p>Selecteer een etappe om details te bekijken.</p>';
            }
        });
        // Optionally, load details for the first stage by default on page load
        if (stageSelect.options.length > 0) {
            stageSelect.value = stageSelect.options[0].value;
            stageSelect.dispatchEvent(new Event('change'));
        }
    }

    // --- Fun Stats Page Functions (fun_stats.html) ---
    async function renderFunStatsPage() {
        const funStatsContainer = document.getElementById('fun-stats-container');
        if (funStatsContainer) {
            funStatsContainer.innerHTML = '<p>Leuke statistieken laden...</p>';
            // Example of fetching and displaying some stats
            const funStats = await fetchData('fun_stats.json'); // You'd need to create this JSON file

            if (funStats) {
                let html = '<h3>Interessante Statistieken</h3>';
                html += '<ul>';
                html += `<li><strong>Meeste Etappeoverwinningen:</strong> ${funStats.most_stage_wins || 'N/A'}</li>`;
                html += `<li><strong>Hoogste Dagscore Poule:</strong> ${funStats.highest_daily_poule_score || 'N/A'} punten</li>`;
                html += `<li><strong>Meeste Uitvallers in Team:</strong> ${funStats.most_dropouts_in_team || 'N/A'}</li>`;
                html += '</ul>';
                funStatsContainer.innerHTML = html;
            } else {
                funStatsContainer.innerHTML = '<p>Geen leuke statistieken beschikbaar.</p>';
            }
        }
    }


    // --- Routing logic based on current page ---
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === '' || currentPage === 'index.html') {
        renderHomePage();
    } else if (currentPage === 'full_leaderboard.html') {
        renderFullLeaderboardPage();
    } else if (currentPage === 'team_selection.html') {
        renderTeamSelectionPage();
    } else if (currentPage === 'stages.html') {
        renderStagesPage();
    } else if (currentPage === 'fun_stats.html') {
        renderFunStatsPage();
    }

});