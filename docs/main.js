document.addEventListener('DOMContentLoaded', () => {
    // Common elements
    const lastUpdatedDateSpan = document.getElementById('last-updated-date');
    const DATA_PATH = './data/';

    // Updated Global Data Variables
    let globalParticipantSelectionsData = null; // participant_selections.json
    let globalRiderCumulativePoints = null; // rider_cumulative_points.json
    let globalParticipantCumulativeLeaderboard = null; // participant_cumulative_points.json (the main leaderboard)
    let globalDetailedRiderHistory = null; // rider_stage_points.json (detailed per-rider, per-stage)
    let globalDetailedParticipantHistory = null; // participant_stage_points.json (detailed per-participant, per-stage)

    let globalAllParticipantNames = []; // Still useful for search functionality

    /**
     * Fetches JSON data from the specified filename within the DATA_PATH.
     * @param {string} filename - The name of the JSON file to fetch.
     * @returns {Promise<Object|null>} A promise that resolves with the parsed JSON data or null if an error occurs.
     */
    async function fetchData(filename) {
        try {
            const response = await fetch(DATA_PATH + filename);
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`File not found: ${filename}. This might be expected for some non-critical data.`);
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Could not fetch ${filename}:`, error);
            return null;
        }
    }

    /**
     * Initializes all global data by fetching necessary JSON files.
     * @returns {Promise<boolean>} True if all critical data loaded successfully, false otherwise.
     */
    async function initializeGlobalData() {
        [
            globalParticipantSelectionsData,
            globalRiderCumulativePoints,
            globalParticipantCumulativeLeaderboard,
            globalDetailedRiderHistory,
            globalDetailedParticipantHistory
        ] = await Promise.all([
            fetchData('participant_selections.json'),
            fetchData('rider_cumulative_points.json'),
            fetchData('participant_cumulative_points.json'),
            fetchData('rider_stage_points.json'),
            fetchData('participant_stage_points.json')
        ]);

        // Check if critical data is loaded
        return globalParticipantSelectionsData && globalRiderCumulativePoints &&
               globalParticipantCumulativeLeaderboard && globalDetailedRiderHistory &&
               globalDetailedParticipantHistory;
    }

    /**
     * Helper to set text content for multiple DOM elements.
     * @param {Array<HTMLElement|null>} elements - An array of DOM elements (can be null).
     * @param {string} text - The text content to set.
     */
    function setTextContent(elements, text) {
        elements.forEach(el => {
            if (el) el.textContent = text;
        });
    }

    // This createTable function seems to be a generic one, keep it as is if not used for the specific new formats
    // Otherwise, it might need significant adaptation or removal.
    // Based on the usage, it seems to be a general utility, but not directly used for the new detailed outputs.
    // I'm leaving it as is for now, assuming its current usage (if any) remains valid for non-reformatted data.
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
            headers.forEach(header => {
                let displayValue;
                switch(header) {
                    case "Rang": displayValue = row.rank; break;
                    case "Deelnemer Naam": displayValue = row.participant_name; break;
                    case "Totaal Score": displayValue = row.total_score; break;
                    case "Dagelijkse Score": displayValue = row.daily_score; break; // This should be 'stage_participant_score' now
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

    /**
     * Creates an HTML table for the leaderboard with expandable rows for stage details.
     * @param {Array<string>} headers - Array of table header names.
     * @param {Array<Object>} data - Array of leaderboard items.
     * @param {Object} detailedParticipantHistory - Global detailed participant history for stage breakdowns.
     * @param {string} primarySortKey - The key used for primary sorting (e.g., 'rank').
     * @returns {string} HTML string of the leaderboard table.
     */
    function createLeaderboardTable(headers, data, detailedParticipantHistory, primarySortKey) {
        if (!data || data.length === 0) {
            return '<p>Geen data om weer te geven.</p>';
        }

        const displayHeaders = headers.slice(0, -1); // Exclude the last empty header

        let tableHTML = '<table class="leaderboard-table">';
        tableHTML += '<thead><tr>';
        displayHeaders.forEach(header => {
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

            tableHTML += `<tr class="leaderboard-row clickable" data-participant-name="${participantName}" data-details-id="details-${index}" aria-expanded="false" aria-controls="details-${index}">`;
            tableHTML += `<td>${rank} ${rankChangeIndicator}</td>`;
            tableHTML += `<td>${participantName}</td>`;
            tableHTML += `<td class="total-score-cell"><span class="total-score-value">${totalScore}</span></td>`;
            tableHTML += '</tr>';

            tableHTML += `<tr class="details-row hidden" id="details-${index}">`;
            tableHTML += `<td colspan="${headers.length - 1}">`;
            tableHTML += `<div class="stage-details-content"></div>`; // Content will be loaded here
            tableHTML += `</td>`;
            tableHTML += `</tr>`;
        });

        tableHTML += '</tbody></table>';

        // Attach event listeners after rendering
        setTimeout(() => {
            document.querySelectorAll('.leaderboard-row.clickable').forEach(row => {
                row.addEventListener('click', (event) => {
                    const clickedRow = event.currentTarget;
                    const participantName = clickedRow.dataset.participantName;
                    const detailsRowId = clickedRow.dataset.detailsId;
                    const detailsRow = document.getElementById(detailsRowId);
                    const detailsContentDiv = detailsRow.querySelector('.stage-details-content');

                    const isExpanded = clickedRow.getAttribute('aria-expanded') === 'true';

                    if (!isExpanded) {
                        // Expand
                        clickedRow.setAttribute('aria-expanded', 'true');
                        detailsRow.classList.remove('hidden');
                        detailsRow.style.display = 'table-row';

                        detailsContentDiv.innerHTML = generateParticipantStagePointsHTML(participantName, detailedParticipantHistory);
                    } else {
                        // Collapse
                        clickedRow.setAttribute('aria-expanded', 'false');
                        detailsRow.classList.add('hidden');
                        detailsRow.style.display = 'none';
                        detailsContentDiv.innerHTML = '';
                    }
                });
            });
        }, 0);

        return tableHTML;
    }

    /**
     * Generates the HTML for individual participant's stage points.
     * Displays only stage number and points, no date or cumulative info.
     * @param {string} participantName - The name of the participant.
     * @param {Object} detailedParticipantHistory - The global detailed participant history object.
     * @returns {string} HTML string of stage points.
     */
    function generateParticipantStagePointsHTML(participantName, detailedParticipantHistory) {
        let stagePointsHTML = '<h4>Punten per Etappe:</h4><ul class="stage-points-list">';

        const participantData = detailedParticipantHistory?.[participantName];

        if (!participantData) {
            return '<p>Geen gedetailleerde etappegegevens beschikbaar voor deze deelnemer.</p>';
        }

        const stages = Object.keys(participantData)
                              .filter(key => key.startsWith('stage_'))
                              .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

        stages.forEach(stageKey => {
            const stageInfo = participantData[stageKey];
            const stageNumber = stageKey.replace('stage_', '');
            const pointsForThisStage = stageInfo?.stage_participant_score || 0;

            // Simplified display: only stage number and points
            stagePointsHTML += `<li>Etappe ${stageNumber}: <span class="stage-point-value">${pointsForThisStage}</span> punten</li>`;
        });

        stagePointsHTML += '</ul>';
        return stagePointsHTML;
    }

    /**
     * Generates the HTML for individual rider contributions within an expanded daily highlight item.
     * Displays only riders who scored points, in a compact list format.
     * @param {Object} riderContributions - The rider_contributions object for a specific participant for the current stage.
     * @returns {string} HTML string.
     */
    function generateRiderContributionsHTML(riderContributions) {
        if (!riderContributions || Object.keys(riderContributions).length === 0) {
            return '<p class="no-rider-details">Geen individuele rennerpunten beschikbaar voor deze deelnemer voor deze etappe.</p>';
        }

        let html = '<h4>Gescoorde Punten per Renner:</h4><ul class="rider-points-list">';
        // Filter for riders who scored points (points > 0) and sort contributions by points descending
        const sortedContributions = Object.entries(riderContributions)
                                          .filter(([, points]) => points > 0) // Only show riders who scored points
                                          .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);

        if (sortedContributions.length === 0) {
            return '<p class="no-rider-details">Geen renners van deze deelnemer hebben punten gescoord in deze etappe.</p>';
        }

        sortedContributions.forEach(([rider, points]) => {
            html += `<li>${rider}: <span class="rider-point-value">${points}</span> punten</li>`;
        });
        html += '</ul>';
        return html;
    }

    /**
     * Creates an HTML list of participants for home page highlights (top 5 daily/cumulative).
     * @param {Array<Object>} data - Array of participant data.
     * @param {boolean} isCumulative - True if rendering cumulative list, false for daily.
     * @param {Array<Object>|null} previousLeaderboard - Previous leaderboard for rank change calculation (only for cumulative).
     * @param {number|null} latestStageNumber - The number of the latest stage (only for daily highlights).
     * @returns {string} HTML string of the participant list.
     */
    function createParticipantList(data, isCumulative = false, previousLeaderboard = null, latestStageNumber = null) {
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
            const score = isCumulative ? item.total_score : item.stage_participant_score;

            let rankChangeIcon = '';
            if (isCumulative && previousLeaderboard) {
                const prevRank = previousLeaderboard.find(prevItem => prevItem.participant_name === name)?.rank;
                if (prevRank) {
                    const change = prevRank - rank;
                    if (change > 0) {
                        rankChangeIcon = `<i class="fas fa-caret-up score-change-icon up"></i> ${change}`;
                    } else if (change < 0) {
                        rankChangeIcon = `<i class="fas fa-caret-down score-change-icon down"></i> ${Math.abs(change)}`;
                    } else {
                        rankChangeIcon = `<i class="fas fa-equals score-change-icon no-change"></i>`;
                    }
                }
            }

            const clickableClass = isCumulative ? '' : ' daily-clickable';
            const detailsId = isCumulative ? '' : `daily-details-${index}`;
            const ariaAttributes = isCumulative ? '' : `aria-expanded="false" aria-controls="${detailsId}"`;

            listHTML += `
                <div class="${itemClass}${clickableClass}"
                     data-participant-name="${name}"
                     data-details-id="${detailsId}"
                     ${ariaAttributes}>
                    <span class="participant-name">${isCumulative ? `<span class="rank-number">${rank}.</span> ` : ''}${name}</span>
                    <span class="participant-score">${score} punten ${rankChangeIcon}</span>
                </div>
                ${isCumulative ? '' : `<div class="daily-details-row hidden" id="${detailsId}">
                    <div class="rider-scores-content"></div>
                </div>`}
            `;
        });
        return listHTML;
    }

    /**
     * Renders the daily highlights section with clickable items that reveal rider details.
     * @param {Array<Object>} dailyParticipantsDataForRender - Sorted list of participants for daily highlight (subset of full data).
     * @param {number} latestStageNumber - The number of the latest processed stage.
     */
    function renderDailyHighlights(dailyParticipantsDataForRender, latestStageNumber) {
        const container = document.getElementById('top-daily-participants');
        if (!container) {
            console.error("Container #top-daily-participants not found.");
            return;
        }

        if (!dailyParticipantsDataForRender || dailyParticipantsDataForRender.length === 0) {
            container.innerHTML = '<p>Geen dagelijkse scores om weer te geven.</p>';
            return;
        }

        container.innerHTML = createParticipantList(dailyParticipantsDataForRender, false, null, latestStageNumber);

        // Attach event listeners after rendering
        setTimeout(() => {
            document.querySelectorAll('.participant-item.daily-clickable').forEach(itemDiv => {
                itemDiv.addEventListener('click', (event) => {
                    const clickedItem = event.currentTarget;
                    const participantName = clickedItem.dataset.participantName;
                    const detailsRowId = clickedItem.dataset.detailsId;
                    const detailsRow = document.getElementById(detailsRowId);
                    const riderScoresContentDiv = detailsRow.querySelector('.rider-scores-content');

                    const isExpanded = clickedItem.getAttribute('aria-expanded') === 'true';

                    if (!isExpanded) {
                        // Expand
                        clickedItem.setAttribute('aria-expanded', 'true');
                        detailsRow.classList.remove('hidden');
                        detailsRow.style.display = 'block';

                        const participantStageData = globalDetailedParticipantHistory?.[participantName]?.[`stage_${latestStageNumber}`];
                        const riderContributions = participantStageData?.rider_contributions || {};
                        
                        riderScoresContentDiv.innerHTML = generateRiderContributionsHTML(riderContributions);
                    } else {
                        // Collapse
                        clickedItem.setAttribute('aria-expanded', 'false');
                        detailsRow.classList.add('hidden');
                        detailsRow.style.display = 'none';
                        riderScoresContentDiv.innerHTML = '';
                    }
                });
            });
        }, 0);
    }

    // --- Home Page Functions (index.html) ---
    async function renderHomePage() {
        // Centralize DOM element references
        const elements = {
            currentStageTitle: document.getElementById('current-stage-title'),
            startLocationSpan: document.getElementById('start-location'),
            finishLocationSpan: document.getElementById('finish-location'),
            distanceKmSpan: document.getElementById('distance-km'),
            stageTypeSpan: document.getElementById('stage-type'),
            yellowJerseySpan: document.getElementById('yellow-jersey'),
            greenJerseySpan: document.getElementById('green-jersey'),
            polkaDotJerseySpan: document.getElementById('polka-dot-jersey'),
            whiteJerseySpan: document.getElementById('white-jersey'),
            notableDropoutSpan: document.getElementById('notable-dropout'),
            topDailyParticipantsDiv: document.getElementById('top-daily-participants'),
            topCumulativeParticipantsDiv: document.getElementById('top-cumulative-participants'),
            finisher1Span: document.getElementById('finisher-1'),
            finisher2Span: document.getElementById('finisher-2'),
            finisher3Span: document.getElementById('finisher-3')
        };

        if (!await initializeGlobalData()) {
            console.error('Niet alle benodigde gegevens konden worden geladen voor de startpagina.');
            setTextContent(Object.values(elements).filter(el => el && el.id !== 'top-daily-participants' && el.id !== 'top-cumulative-participants'), 'Gegevens laden mislukt.');
            if (elements.topDailyParticipantsDiv) elements.topDailyParticipantsDiv.innerHTML = '<p>Gegevens laden mislukt.</p>';
            if (elements.topCumulativeParticipantsDiv) elements.topCumulativeParticipantsDiv.innerHTML = '<p>Gegevens laden mislukt.</p>';
            return;
        }

        let latestStageNumber = 0;
        let latestDate = 'N/A';

        // Determine the latest stage number and date from detailed rider history
        const sampleRiderName = Object.keys(globalDetailedRiderHistory)[0];
        if (sampleRiderName) {
            const riderStages = Object.keys(globalDetailedRiderHistory[sampleRiderName])
                                      .filter(key => key.startsWith('stage_'))
                                      .map(key => parseInt(key.split('_')[1]));
            if (riderStages.length > 0) {
                latestStageNumber = Math.max(...riderStages);
                latestDate = globalDetailedRiderHistory[sampleRiderName][`stage_${latestStageNumber}`]?.date || 'N/A';
            }
        }
        
        if (latestStageNumber === 0) {
            console.warn('Geen etappegegevens beschikbaar in gedetailleerde geschiedenisbestanden.');
            setTextContent(Object.values(elements).filter(el => el && el.id !== 'top-daily-participants' && el.id !== 'top-cumulative-participants'), 'N/A');
            if (elements.currentStageTitle) elements.currentStageTitle.textContent = 'Nog geen etappegegevens beschikbaar.';
            if (elements.topDailyParticipantsDiv) elements.topDailyParticipantsDiv.innerHTML = '<p>Geen dagelijkse deelnemersscores beschikbaar.</p>';
            if (elements.topCumulativeParticipantsDiv) elements.topCumulativeParticipantsDiv.innerHTML = '<p>Geen algemeen klassement beschikbaar.</p>';
            return;
        }

        if (lastUpdatedDateSpan) lastUpdatedDateSpan.textContent = latestDate;
        if (elements.currentStageTitle) elements.currentStageTitle.textContent = `Meest Recente Etappe: Etappe ${latestStageNumber} (${latestDate})`;

        const simulatedStageData = await fetchData(`simulated_stages/stage_${latestStageNumber}_data.json`);

        if (simulatedStageData) {
            if (elements.startLocationSpan) elements.startLocationSpan.textContent = simulatedStageData.start_location || 'Onbekend';
            if (elements.finishLocationSpan) elements.finishLocationSpan.textContent = simulatedStageData.finish_location || 'Onbekend';
            if (elements.distanceKmSpan) elements.distanceKmSpan.textContent = simulatedStageData.distance_km ? `${simulatedStageData.distance_km} km` : 'Onbekend';
            if (elements.stageTypeSpan) elements.stageTypeSpan.textContent = simulatedStageData.stage_type || 'Onbekend';

            const stageResults = simulatedStageData.stage_results;
            const jerseyHolders = simulatedStageData.jersey_holders;

            if (stageResults && stageResults.length > 0) {
                if (elements.finisher1Span) elements.finisher1Span.textContent = stageResults[0]?.rider_name || '-';
                if (elements.finisher2Span) elements.finisher2Span.textContent = stageResults[1]?.rider_name || '-';
                if (elements.finisher3Span) elements.finisher3Span.textContent = stageResults[2]?.rider_name || '-';
            } else {
                setTextContent([elements.finisher1Span, elements.finisher2Span, elements.finisher3Span], '-');
            }

            if (elements.yellowJerseySpan) elements.yellowJerseySpan.textContent = jerseyHolders.yellow || 'N/A';
            if (elements.greenJerseySpan) elements.greenJerseySpan.textContent = jerseyHolders.green || 'N/A';
            if (elements.polkaDotJerseySpan) elements.polkaDotJerseySpan.textContent = jerseyHolders.polka_dot || 'N/A';
            if (elements.whiteJerseySpan) elements.whiteJerseySpan.textContent = jerseyHolders.white || 'N/A';

            if (elements.notableDropoutSpan) elements.notableDropoutSpan.textContent = 'N/A (Gegevens niet beschikbaar)';

        } else {
            console.warn(`Simulatiegegevens voor Etappe ${latestStageNumber} niet gevonden.`);
            setTextContent([elements.startLocationSpan, elements.finishLocationSpan, elements.distanceKmSpan, elements.stageTypeSpan,
                            elements.yellowJerseySpan, elements.greenJerseySpan, elements.polkaDotJerseySpan, elements.whiteJerseySpan,
                            elements.notableDropoutSpan], 'Gegevens niet beschikbaar.');
        }

        // Prepare data for Top 5 Daily Scorers (Participants)
        const dailyParticipantsDataForRender = [];
        if (globalDetailedParticipantHistory) {
            for (const participantName in globalDetailedParticipantHistory) {
                const stageData = globalDetailedParticipantHistory[participantName]?.[`stage_${latestStageNumber}`];
                if (stageData) {
                    dailyParticipantsDataForRender.push({
                        participant_name: participantName,
                        stage_participant_score: stageData.stage_participant_score || 0,
                        rider_contributions: stageData.rider_contributions || {}
                    });
                }
            }
            dailyParticipantsDataForRender.sort((a, b) => b.stage_participant_score - a.stage_participant_score);
            renderDailyHighlights(dailyParticipantsDataForRender.slice(0, 5), latestStageNumber);
        } else {
            if (elements.topDailyParticipantsDiv) elements.topDailyParticipantsDiv.innerHTML = '<p>Geen dagelijkse deelnemersscores beschikbaar voor deze etappe.</p>';
        }

        // Render Top 5 Overall Standings (Participants)
        if (globalParticipantCumulativeLeaderboard && globalParticipantCumulativeLeaderboard.length > 0) {
            const top5Cumulative = globalParticipantCumulativeLeaderboard.slice(0, 5);
            let previousCumulativeLeaderboard = null;
            if (latestStageNumber > 1) {
                const prevStageEntryKey = `stage_${latestStageNumber - 1}`;
                const prevLeaderboardRaw = [];
                for (const pName in globalDetailedParticipantHistory) {
                    const prevStageData = globalDetailedParticipantHistory[pName]?.[prevStageEntryKey];
                    if (prevStageData) {
                        prevLeaderboardRaw.push({
                            participant_name: pName,
                            total_score: prevStageData.cumulative_participant_score_after_stage,
                        });
                    }
                }
                if (prevLeaderboardRaw.length > 0) {
                    previousCumulativeLeaderboard = prevLeaderboardRaw
                        .sort((a, b) => b.total_score - a.total_score)
                        .map((item, idx) => ({ ...item, rank: idx + 1 }));
                }
            }
            if (elements.topCumulativeParticipantsDiv) elements.topCumulativeParticipantsDiv.innerHTML = createParticipantList(top5Cumulative, true, previousCumulativeLeaderboard);
        } else {
            if (elements.topCumulativeParticipantsDiv) elements.topCumulativeParticipantsDiv.innerHTML = '<p>Geen algemeen klassement beschikbaar.</p>';
        }
    }

    // --- Full Leaderboard Page Functions (full_leaderboard.html) ---
    async function renderFullLeaderboardPage() {
        const fullLeaderboardContainer = document.getElementById('full-leaderboard-container');
        if (!fullLeaderboardContainer) {
            console.error("Container #full-leaderboard-container not found.");
            return;
        }
        fullLeaderboardContainer.innerHTML = '<p>Volledig klassement laden...</p>';

        if (!await initializeGlobalData()) {
            console.error('Niet alle benodigde gegevens konden worden geladen voor het volledige klassement.');
            fullLeaderboardContainer.innerHTML = '<p>Fout bij het laden van het klassement. Probeer later opnieuw.</p>';
            return;
        }

        if (globalParticipantCumulativeLeaderboard && globalParticipantCumulativeLeaderboard.length > 0) {
            const headers = ["Rang", "Deelnemer Naam", "Totaal Score", ""];
            fullLeaderboardContainer.innerHTML = createLeaderboardTable(headers, globalParticipantCumulativeLeaderboard, globalDetailedParticipantHistory, 'rank');
        } else {
            fullLeaderboardContainer.innerHTML = '<p>Geen volledig klassement beschikbaar.</p>';
        }
    }

    // --- Team Selection Page Functions (team_selection.html) ---
    async function displayParticipantTeam(participantName) {
        const selectedParticipantDetails = document.getElementById('selected-participant-details');
        if (!selectedParticipantDetails) {
            console.error("Element with ID 'selected-participant-details' not found.");
            return;
        }
        selectedParticipantDetails.innerHTML = '';

        if (!participantName) {
            selectedParticipantDetails.innerHTML = '<p>Selecteer een deelnemer om de teamselectie te bekijken.</p>';
            return;
        }

        const selectionDetails = globalParticipantSelectionsData?.[participantName];
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

        // globalRiderCumulativePoints should already be loaded by renderTeamSelectionPage
        if (!globalRiderCumulativePoints) {
            console.error('Cumulative rider points not loaded. This should have been loaded by renderTeamSelectionPage.');
            selectedParticipantDetails.innerHTML = `<p>Fout bij het laden van rennerpunten voor ${participantName}.</p>`;
            return;
        }

        selectionDetails.main_riders.forEach(rider => {
            const points = globalRiderCumulativePoints[rider] || 0;
            totalCumulativePoints += points;
            htmlContent += `
                <tr>
                    <td>${rider}</td>
                    <td>${points}</td>
                </tr>
            `;
        });

        if (selectionDetails.reserve_rider) {
            const reservePoints = globalRiderCumulativePoints[selectionDetails.reserve_rider] || 0;
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

    /**
     * Renders the list of participants for the search functionality on the team selection page.
     * @param {Array<string>} namesToDisplay - Array of participant names to display.
     */
    function renderParticipantList(namesToDisplay) {
        const allParticipantsListDiv = document.getElementById('all-participants-list');
        if (!allParticipantsListDiv) {
            console.error("Element with ID 'all-participants-list' not found.");
            return;
        }
        allParticipantsListDiv.innerHTML = '';

        if (namesToDisplay.length === 0) {
            allParticipantsListDiv.innerHTML = '<p class="no-results">Geen deelnemers gevonden die overeenkomen met de zoekterm.</p>';
            return;
        }

        namesToDisplay.forEach(name => {
            const participantItem = document.createElement('div');
            participantItem.classList.add('participant-item');
            participantItem.textContent = name;
            participantItem.addEventListener('click', () => {
                const participantSearchInput = document.getElementById('participant-search');
                if (participantSearchInput) participantSearchInput.value = name;
                displayParticipantTeam(name);
                document.getElementById('selected-participant-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            allParticipantsListDiv.appendChild(participantItem);
        });
    }

    // --- Team Selection Page Functions (team_selection.html) ---
    async function renderTeamSelectionPage() {
        const participantSearchInput = document.getElementById('participant-search');
        const allParticipantsListDiv = document.getElementById('all-participants-list');
        const selectedParticipantDetails = document.getElementById('selected-participant-details');

        if (!allParticipantsListDiv) { console.error("Element with ID 'all-participants-list' not found."); return; }
        allParticipantsListDiv.innerHTML = '<p>Deelnemers laden...</p>';

        if (!await initializeGlobalData()) {
            allParticipantsListDiv.innerHTML = '<p>Geen deelnemersselecties gevonden. Zorg ervoor dat de data bestanden correct zijn gegenereerd.</p>';
            if (selectedParticipantDetails) selectedParticipantDetails.innerHTML = '<p>Fout bij het laden van gegevens.</p>';
            return;
        }

        globalAllParticipantNames = Object.keys(globalParticipantSelectionsData).sort();
        renderParticipantList(globalAllParticipantNames);

        if (participantSearchInput) {
            participantSearchInput.addEventListener('input', (event) => {
                const searchTerm = event.target.value.toLowerCase();
                const filteredNames = globalAllParticipantNames.filter(name =>
                    name.toLowerCase().includes(searchTerm)
                );
                renderParticipantList(filteredNames);
            });
        }

        if (selectedParticipantDetails) {
            selectedParticipantDetails.innerHTML = '<p>Selecteer een deelnemer uit de lijst om de teamdetails te bekijken.</p>';
        }
    }

    // --- Router to call the correct rendering function based on the page ---
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === '' || currentPage === 'index.html') {
        renderHomePage();
    } else if (currentPage === 'full_leaderboard.html') {
        renderFullLeaderboardPage();
    } else if (currentPage === 'team_selection.html') {
        renderTeamSelectionPage();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // ... (your existing code) ...

    // --- Hamburger Menu Logic ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            // Toggle aria-expanded for accessibility
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
        });

        // Close menu when a link is clicked (optional, but good for UX)
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                hamburger.setAttribute('aria-expanded', false);
            });
        });
    }

    // --- Router to call the correct rendering function based on the page ---
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === '' || currentPage === 'index.html') {
        renderHomePage();
    } else if (currentPage === 'full_leaderboard.html') {
        renderFullLeaderboardPage();
    } else if (currentPage === 'team_selection.html') {
        renderTeamSelectionPage();
    }
});