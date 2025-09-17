let availableScenarios = [];
let selectedScenario = null;
let currentAnalysisResult = null;

document.addEventListener('DOMContentLoaded', loadAndDisplayScenarios);

async function loadAndDisplayScenarios() {
    console.log('Loading scenarios...');
    
    try {
        const response = await fetch('/api/scenarios');
        availableScenarios = await response.json();
        console.log('Loaded scenarios:', availableScenarios.length);
        
        renderScenarioButtons();
    } catch (error) {
        console.error('Failed to load scenarios:', error);
        showError('Error loading scenarios');
    }
}

function renderScenarioButtons() {
    const buttonContainer = document.getElementById('scenarioButtons');
    
    if (!buttonContainer) {
        console.error('Scenario buttons container not found');
        return;
    }
    
    buttonContainer.innerHTML = '';
    
    availableScenarios.forEach(scenario => {
        const button = createScenarioButton(scenario);
        buttonContainer.appendChild(button);
    });
    
    console.log('Rendered scenario buttons:', availableScenarios.length);
}

function createScenarioButton(scenario) {
    const button = document.createElement('button');
    button.className = 'scenario-btn';
    button.innerHTML = `
        <h4>${scenario.title}</h4>
        <p>${scenario.description}</p>
    `;
    button.onclick = () => selectScenario(scenario);
    return button;
}

function selectScenario(scenario) {
    console.log('Selected scenario:', scenario.title);
    selectedScenario = scenario;
    currentAnalysisResult = null;
    
    showMainDemo();
    displayConversationTranscript(scenario.transcription);
    enableAnalysisButton();
    clearPreviousAnalysis();
    scrollToDemo();
}

function showMainDemo() {
    document.getElementById('mainDemo').style.display = 'block';
}

function displayConversationTranscript(transcription) {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';
    
    const conversationLines = parseTranscription(transcription);
    
    conversationLines.forEach(line => {
        const messageElement = createChatMessage(line);
        chatContainer.appendChild(messageElement);
    });
}

function parseTranscription(transcription) {
    return transcription
        .split('\n\n')
        .filter(line => line.trim())
        .map(line => {
            if (line.startsWith('Agent:')) {
                return { type: 'agent', content: line.replace('Agent:', '').trim() };
            } else if (line.startsWith('Customer:')) {
                return { type: 'customer', content: line.replace('Customer:', '').trim() };
            }
            return null;
        })
        .filter(Boolean);
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createChatMessage(messageData) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${messageData.type}`;
    // Use escaped content to avoid XSS from transcripts
    messageElement.innerHTML = `
        <div class="speaker">${capitalize(messageData.type)}</div>
        <div class="content">${escapeHtml(messageData.content)}</div>
    `;
    return messageElement;
}

function enableAnalysisButton() {
    const analyzeButton = document.getElementById('analyzeBtn');
    analyzeButton.disabled = false;
    analyzeButton.onclick = analyzeConversation;
    
    document.getElementById('resetBtn').onclick = resetDemo;
}

async function analyzeConversation() {
    if (!selectedScenario) return;
    
    const analyzeButton = document.getElementById('analyzeBtn');
    setButtonLoadingState(analyzeButton, 'Analyzing...');
    
    try {
        const analysisResponse = await requestAnalysis();
        currentAnalysisResult = analysisResponse.analysis;
        
        displayAnalysisResults(analysisResponse.analysis);
        displayStructuredDataSchema(analysisResponse.schema, analysisResponse.analysis);
        showHumanReviewOptions();
        
    } catch (error) {
        console.error('Analysis failed:', error);
        showError('Analysis failed: ' + error.message);
    } finally {
        resetButtonState(analyzeButton, 'Analyze with AI');
    }
}

function setButtonLoadingState(button, loadingText) {
    button.disabled = true;
    button.textContent = loadingText;
}

function resetButtonState(button, originalText) {
    button.disabled = false;
    button.textContent = originalText;
}

async function requestAnalysis() {
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transcription: selectedScenario.transcription,
            scenarioId: selectedScenario.id
        })
    });
    
    if (!response.ok) {
        throw new Error(`Analysis request failed: HTTP ${response.status}`);
    }
    
    return await response.json();
}

function displayAnalysisResults(analysisData) {
    const analysisContainer = document.getElementById('analysisContent');
    analysisContainer.innerHTML = createAnalysisMarkup(analysisData);
}

function createAnalysisMarkup(analysis) {
    return `
        <div class="analysis-card">
            <h4>Sentiment Analysis</h4>
            <div class="sentiment-${analysis.sentiment}">
                <strong>${formatSentiment(analysis.sentiment)}</strong>
                <span class="confidence-score">${Math.round(analysis.confidenceScore * 100)}% confidence</span>
            </div>
        </div>

        <div class="analysis-card">
            <h4>Escalation Risk</h4>
            <div class="risk-${analysis.escalationRisk}">
                <strong>${formatRiskLevel(analysis.escalationRisk)}</strong>
            </div>
        </div>

        <div class="analysis-card">
            <h4>Primary Intent</h4>
            <div><strong>${formatIntent(analysis.primaryIntent)}</strong></div>
        </div>

        <div class="analysis-card">
            <h4>Key Information</h4>
            <div class="key-info-grid">${createKeyInformationMarkup(analysis.keyInformation)}</div>
        </div>

        <div class="analysis-card">
            <h4>Suggested Actions</h4>
            <div class="actions-list">${createActionTags(analysis.suggestedActions)}</div>
        </div>

        <div class="analysis-card">
            <h4>Commitments Made</h4>
            <div class="actions-list">${createActionTags(analysis.commitments)}</div>
        </div>

        <div class="analysis-card">
            <h4>Summary</h4>
            <p>${analysis.summary}</p>
        </div>
    `;
}

function displayStructuredDataSchema(schema, analysisData) {
    const schemaSection = document.getElementById('schemaSection');
    const schemaContainer = document.getElementById('schemaContent');
    
    if (!schemaSection || !schemaContainer) return;
    
    const crmPayloadData = buildCrmPayload(analysisData);
    const formattedJson = JSON.stringify(crmPayloadData, null, 4);
    const highlightedJson = addJsonSyntaxHighlighting(escapeHtml(formattedJson));
    
    schemaContainer.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p>This structured format can be automatically sent to your CRM system:</p>
        </div>
        <div class="schema-preview">${highlightedJson}</div>
    `;
    
    schemaSection.style.display = 'block';
}

function buildCrmPayload(analysis) {
    return {
        sentiment: analysis.sentiment,
        escalationRisk: analysis.escalationRisk,
        primaryIntent: analysis.primaryIntent,
        keyInformation: analysis.keyInformation,
        suggestedActions: analysis.suggestedActions,
        commitments: analysis.commitments,
        confidenceScore: analysis.confidenceScore,
        summary: analysis.summary
    };
}

function addJsonSyntaxHighlighting(jsonString) {
    return jsonString.replace(
        /&quot;([^&]+)&quot;:/g, 
        '<span class="json-key">&quot;$1&quot;:</span>'
    );
}

function showHumanReviewOptions() {
    const reviewSection = document.getElementById('reviewSection');
    if (reviewSection) {
        reviewSection.style.display = 'block';
        attachReviewEventListeners();
    }
}

function attachReviewEventListeners() {
    document.getElementById('editBtn').onclick = openAnalysisEditor;
    document.getElementById('approveBtn').onclick = approveAndFinalize;
}

function openAnalysisEditor() {
    if (!currentAnalysisResult) return;
    
    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    
    editForm.innerHTML = createEditFormMarkup(currentAnalysisResult);
    editModal.style.display = 'flex';
    
    attachModalEventListeners();
}

function createEditFormMarkup(analysis) {
    return `
        <div class="form-group">
            <label for="editSentiment">Sentiment:</label>
            <select id="editSentiment">
                <option value="positive" ${isSelected(analysis.sentiment, 'positive')}>Positive</option>
                <option value="neutral" ${isSelected(analysis.sentiment, 'neutral')}>Neutral</option>
                <option value="negative" ${isSelected(analysis.sentiment, 'negative')}>Negative</option>
                <option value="frustrated" ${isSelected(analysis.sentiment, 'frustrated')}>Frustrated</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="editRisk">Escalation Risk:</label>
            <select id="editRisk">
                <option value="low" ${isSelected(analysis.escalationRisk, 'low')}>Low</option>
                <option value="medium" ${isSelected(analysis.escalationRisk, 'medium')}>Medium</option>
                <option value="high" ${isSelected(analysis.escalationRisk, 'high')}>High</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="editIntent">Primary Intent:</label>
            <input type="text" id="editIntent" value="${analysis.primaryIntent}">
        </div>
        
        <div class="form-group">
            <label for="editSummary">Summary:</label>
            <textarea id="editSummary">${analysis.summary}</textarea>
        </div>
        
        <div class="form-group">
            <label for="editActions">Suggested Actions (comma-separated):</label>
            <textarea id="editActions">${analysis.suggestedActions.join(', ')}</textarea>
        </div>
    `;
}

function attachModalEventListeners() {
    document.getElementById('closeModal').onclick = closeAnalysisEditor;
    document.getElementById('cancelEdit').onclick = closeAnalysisEditor;
    document.getElementById('saveChanges').onclick = saveAnalysisEdits;
}

function closeAnalysisEditor() {
    document.getElementById('editModal').style.display = 'none';
}

function saveAnalysisEdits() {
    currentAnalysisResult = {
        ...currentAnalysisResult,
        sentiment: document.getElementById('editSentiment').value,
        escalationRisk: document.getElementById('editRisk').value,
        primaryIntent: document.getElementById('editIntent').value,
        summary: document.getElementById('editSummary').value,
        suggestedActions: parseCommaSeparatedValues(document.getElementById('editActions').value)
    };
    
    displayAnalysisResults(currentAnalysisResult);

    displayStructuredDataSchema(null, currentAnalysisResult);
    
    closeAnalysisEditor();
    console.log('Analysis updated by human review');
}

async function approveAndFinalize() {
    if (!currentAnalysisResult) return;
    
    showCrmIntegrationProgress();
    
    try {
        const finalizationResponse = await submitFinalAnalysis();
        showCrmIntegrationSuccess();
        displayCrmRecord(finalizationResponse.crmRecord);
        generateCustomerEmail(finalizationResponse.crmRecord);
        
    } catch (error) {
        console.error('Finalization failed:', error);
        showCrmIntegrationError();
        showError('Failed to create CRM record: ' + error.message);
    }
}

async function submitFinalAnalysis() {
    const response = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            analysis: currentAnalysisResult,
            scenarioId: selectedScenario.id
        })
    });
    
    if (!response.ok) {
        throw new Error(`Finalization failed: HTTP ${response.status}`);
    }
    
    return await response.json();
}

function showCrmIntegrationProgress() {
    const schemaSection = document.getElementById('schemaSection');
    const schemaContainer = document.getElementById('schemaContent');
    
    if (!schemaContainer) return;
    
    // Add integration status to existing schema display
    const existingContent = schemaContainer.innerHTML;
    schemaContainer.innerHTML = existingContent + `
        <div class="integration-status" id="integrationStatus">
            <div class="integration-progress">
                <div class="spinner-small"></div>
                <span>Sending to Dynamics 365...</span>
            </div>
        </div>
    `;
}

function showCrmIntegrationSuccess() {
    const integrationStatus = document.getElementById('integrationStatus');
    if (!integrationStatus) return;
    
    integrationStatus.innerHTML = `
        <div class="integration-success">
            <span class="success-icon">✓</span>
            <span>Successfully created case in Dynamics 365</span>
            <div class="integration-details">
                <small>Case assigned to Customer Service Team • SLA: 4 hours • Workflow triggered</small>
            </div>
        </div>
    `;
}

function showCrmIntegrationError() {
    const integrationStatus = document.getElementById('integrationStatus');
    if (!integrationStatus) return;
    
    integrationStatus.innerHTML = `
        <div class="integration-error">
            <span class="error-icon">⚠</span>
            <span>Failed to connect to Dynamics 365</span>
        </div>
    `;
}

function displayCrmRecord(crmData) {
    const crmSection = document.getElementById('crmSection');
    const crmContainer = document.getElementById('crmContent');
    
    crmContainer.innerHTML = createEnhancedCrmRecordMarkup(crmData);
    crmSection.style.display = 'block';
    
    // Add visual connection to the integration
    setTimeout(() => {
        const crmHeader = crmSection.querySelector('.panel-header h3');
        if (crmHeader) {
            crmHeader.innerHTML = `
                Dynamics 365 Case Created 
                <a href="#" class="case-link" onclick="openMockCrmRecord('${crmData.caseId}')">${crmData.caseId}</a>
            `;
        }
        crmSection.scrollIntoView({ behavior: 'smooth' });
    }, 500);
}

function createEnhancedCrmRecordMarkup(crmRecord) {
    return `
        <div class="crm-integration-header">
            <div class="dynamics-logo">
                <strong>Microsoft Dynamics 365 Customer Service</strong>
            </div>
            <div class="integration-timestamp">
                Synchronized ${escapeHtml(new Date().toLocaleTimeString())}
            </div>
        </div>
        
        <div class="crm-record">
            <div class="crm-field primary-field">
                <strong>Case Number</strong>
                <div class="field-value">${escapeHtml(crmRecord.caseId)}</div>
                <div class="field-note">Auto-generated from call analysis</div>
            </div>
            <div class="crm-field">
                <strong>Title</strong>
                <div class="field-value">${escapeHtml(crmRecord.title)}</div>
            </div>
            <div class="crm-field priority-field">
                <strong>Priority</strong>
                <div class="field-value">
                    <span class="priority-${escapeHtml(crmRecord.priority.toLowerCase())}">${escapeHtml(crmRecord.priority)}</span>
                    <div class="field-note">Based on escalation risk analysis</div>
                </div>
            </div>
            <div class="crm-field">
                <strong>Status</strong>
                <div class="field-value">${escapeHtml(crmRecord.status)}</div>
            </div>
            <div class="crm-field">
                <strong>Assigned To</strong>
                <div class="field-value">${escapeHtml(crmRecord.assignedTo)}</div>
                <div class="field-note">Auto-routed based on category</div>
            </div>
            <div class="crm-field">
                <strong>Category</strong>
                <div class="field-value">${escapeHtml(crmRecord.category)}</div>
            </div>
            <div class="crm-field">
                <strong>SLA Target</strong>
                <div class="field-value">${escapeHtml(new Date(crmRecord.estimatedResolution).toLocaleString())}</div>
                <div class="field-note">Calculated from priority level</div>
            </div>
            <div class="crm-field">
                <strong>Created</strong>
                <div class="field-value">${escapeHtml(new Date(crmRecord.createdAt).toLocaleString())}</div>
            </div>
        </div>
        
        <div class="crm-description-section">
            <strong>Case Description</strong>
            <div class="description-content">
                ${escapeHtml(crmRecord.description)}
            </div>
        </div>
        
        <div class="automated-actions">
            <strong>Automated Actions Triggered</strong>
            <ul class="action-list">
                <li>Customer notification email queued</li>
                <li>Escalation reminder set for ${escapeHtml(getEscalationTime(crmRecord.priority))}</li>
                <li>Related cases cross-referenced</li>
                <li>Agent performance metrics updated</li>
            </ul>
        </div>
    `;
}

function getEscalationTime(priority) {
    const escalationHours = priority === 'High' ? 2 : priority === 'Medium' ? 8 : 24;
    const escalationTime = new Date(Date.now() + escalationHours * 60 * 60 * 1000);
    return escalationTime.toLocaleString();
}

function openMockCrmRecord(caseId) {
    alert(`In a real implementation, this would open ${caseId} directly in Dynamics 365.\n\nURL would be something like:\nhttps://yourorg.dynamics.com/main.aspx?etc=112&id=${caseId}`);
    return false;
}

function generateCustomerEmail(crmRecord) {
    const customerName = extractCustomerNameFromTranscript();
    const emailMarkup = createEmailMarkup(crmRecord, customerName);
    
    document.getElementById('crmContent').innerHTML += emailMarkup;
}

function createEmailMarkup(crmRecord, customerName) {
    const greeting = customerName ? `Dear ${escapeHtml(customerName)},` : 'Dear Valued Customer,';
    
    return `
        <div class="email-section">
            <h4>Customer Follow-up Email</h4>
            <div class="email-preview">
                <strong>Subject:</strong> Follow-up: Your Support Case ${escapeHtml(crmRecord.caseId)}<br><br>
                
                <strong>${greeting}</strong><br><br>
                
                Thank you for contacting our support team today. We've created case ${escapeHtml(crmRecord.caseId)} to track your request.<br><br>
                
                <strong>Summary:</strong><br>
                ${escapeHtml(crmRecord.description)}<br><br>
                
                <strong>Next steps:</strong><br>
                ${escapeHtml(crmRecord.nextActions.map(action => `• ${formatAction(action)}`).join('\n')).replace(/\n/g, '<br>')}<br><br>
                
                <strong>Priority:</strong> ${escapeHtml(crmRecord.priority)}<br>
                <strong>Expected resolution:</strong> ${escapeHtml(new Date(crmRecord.estimatedResolution).toLocaleDateString())}<br><br>
                
                Best regards,<br>
                Customer Service Team
            </div>
            
            <div class="email-actions">
                <button onclick="simulateEmailSend()" class="send-email-btn">Send Email (Demo)</button>
                <button onclick="openEmailGuideVideo()" class="view-acs-demo-btn">View Email Setup Guide</button>
            </div>
        </div>
    `;
}

function extractCustomerNameFromTranscript() {
    const transcript = selectedScenario?.transcription || '';
    
    // Look for patterns where agents use customer names in context
    const namePatterns = [
        /Absolutely,?\s+([A-Z][a-z]+)\./, // "Absolutely, Sarah."
        /I see your (?:account|reservation) here.*?([A-Z][a-z]+)/, // "I see your account here and... Sarah"
        /thank you,?\s+([A-Z][a-z]+)\./, // "Thank you, Michael."
        /Great,?\s+thank you\s+([A-Z][a-z]+)\./, // "Great, thank you Michael."
        /No worries,?\s+([A-Z][a-z]+)\./, // "No worries, Sarah."
    ];
    
    for (const pattern of namePatterns) {
        const match = transcript.match(pattern);
        if (match && match[1] && match[1].length > 2) {
            // Filter out common words that aren't names
            const excludeWords = ['for', 'the', 'and', 'you', 'can', 'will', 'are', 'have'];
            if (!excludeWords.includes(match[1].toLowerCase())) {
                return match[1];
            }
        }
    }
    
    return null;
}

function simulateEmailSend() {
    alert('Customer email sent!\n\nIn production, this would use Azure Communication Services Email API.');
}

function openEmailGuideVideo() {
    window.open('https://www.youtube.com/watch?v=Q2RRqgy_G9g', '_blank');
}

function formatSentiment(sentiment) {
    const sentimentLabels = { 
        positive: 'Positive', 
        negative: 'Negative', 
        neutral: 'Neutral', 
        frustrated: 'Frustrated' 
    };
    return sentimentLabels[sentiment] || sentiment;
}

function formatRiskLevel(riskLevel) {
    const riskLabels = { 
        low: 'Low Risk', 
        medium: 'Medium Risk', 
        high: 'High Risk' 
    };
    return riskLabels[riskLevel] || riskLevel;
}

function formatIntent(intent) {
    return intent.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatAction(action) {
    return action.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function createKeyInformationMarkup(keyInformation) {
    if (!keyInformation || Object.keys(keyInformation).length === 0) {
        return '<div class="key-info-item">No specific information extracted</div>';
    }
    
    return Object.entries(keyInformation)
        .filter(([key, value]) => value && value !== 'null')
        .map(([key, value]) => `
            <div class="key-info-item">
                <strong>${formatFieldName(key)}:</strong>
                ${escapeHtml(value)}
            </div>
        `).join('');
}

function createActionTags(actions) {
    return actions
        .map(action => `<span class="action-tag">${escapeHtml(formatAction(action))}</span>`)
        .join('');
}

function clearPreviousAnalysis() {
    document.getElementById('analysisContent').innerHTML = `
        <div class="analysis-placeholder">
            Click "Analyze with AI" to see intelligent insights...
        </div>
    `;
    
    hideAnalysisSections();
}

function hideAnalysisSections() {
    const sectionIds = ['reviewSection', 'schemaSection', 'crmSection'];
    sectionIds.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) element.style.display = 'none';
    });
}

function resetDemo() {
    document.getElementById('mainDemo').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToDemo() {
    document.getElementById('mainDemo').scrollIntoView({ behavior: 'smooth' });
}

function showError(message) {
    const errorContainer = document.getElementById('scenarioButtons');
    if (errorContainer) {
        errorContainer.innerHTML = `<p style="color: red;">${message}</p>`;
    }
    console.error(message);
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function isSelected(currentValue, optionValue) {
    return currentValue === optionValue ? 'selected' : '';
}

function parseCommaSeparatedValues(inputString) {
    return inputString
        .split(',')
        .map(value => value.trim())
        .filter(value => value);
}

function formatFieldName(fieldName) {
    return fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, character => character.toUpperCase());
}