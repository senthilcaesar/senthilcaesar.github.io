        (function () {
            const trigger = document.getElementById('terminal-trigger');
            const windowDiv = document.getElementById('terminal-window');
            const closeBtn = windowDiv.querySelector('.btn.close');
            const minimizeBtn = windowDiv.querySelector('.btn.minimize');
            const maximizeBtn = windowDiv.querySelector('.btn.maximize');
            const header = windowDiv.querySelector('.terminal-header');
            const input = document.getElementById('terminal-input');
            const outputContainer = windowDiv.querySelector('.terminal-output');
            const body = document.getElementById('terminal-body');

            const commandHistory = [];
            let historyIndex = -1;
            let isTyping = false;
            let hasTypedWelcome = false;
            const TYPING_SPEED = 4; // ms per character (extremely fast)

            const qaDatabase = [
                {
                    keywords: ["who is senthil", "who are you", "what is your name", "senthil palanivelu", "about senthil"],
                    answer: "I'm a CS graduate from UMass Boston specializing in Data Analytics, AI Engineering, and Machine Learning. I'm passionate about using evidence-based insights to solve real-world problems."
                },
                {
                    keywords: ["where do you live", "where does he live", "location", "where is he", "where are you based", "address", "city"],
                    answer: "I live in Bangalore, India."
                },
                {
                    keywords: ["hobbies", "interest", "what does he do in his free time", "outside of work", "hobby"],
                    answer: "My hobbies include reading books (feel free to check out my <a class=\"link\" href=\"https://senthilcaesar.github.io/my-reading/\" target=\"_blank\">readings page</a>!), hiking, travelling, exploring new tech, and listening to music."
                },
                {
                    keywords: ["currently learning", "what is he learning", "current focus", "what is he studying", "learning now"],
                    answer: "I'm currently learning AI Agentic coding frameworks, TypeScript, LangFuse, and effective communication."
                },
                {
                    keywords: ["like to work with", "working style", "what is he like as a colleague", "work style", "work with"],
                    answer: "I'm analytical, proactive, and value collaboration. I focus on delivering clear business value, writing clean documentation, and evidence-based problem-solving."
                },
                {
                    keywords: ["work experience", "experience", "projects", "what has he built", "employment", "career", "jobs"],
                    answer: "I've built analytical data pipelines, AI models, and portfolio applications. Check out my <a class=\"link\" href=\"https://senthilcaesar.github.io/portfolio/\" target=\"_blank\">Portfolio</a> to see my projects."
                },
                {
                    keywords: ["senthilcaesar", "alias", "github name"],
                    answer: "SenthilCaesar is my GitHub handle and developer alias."
                }
            ];

            function tokenizeHTML(htmlString) {
                const tokens = [];
                let i = 0;
                while (i < htmlString.length) {
                    if (htmlString[i] === '<') {
                        const endIdx = htmlString.indexOf('>', i);
                        if (endIdx !== -1) {
                            tokens.push(htmlString.substring(i, endIdx + 1));
                            i = endIdx + 1;
                        } else {
                            tokens.push(htmlString[i]);
                            i++;
                        }
                    } else if (htmlString[i] === '&') {
                        const endIdx = htmlString.indexOf(';', i);
                        if (endIdx !== -1 && endIdx - i < 10) {
                            tokens.push(htmlString.substring(i, endIdx + 1));
                            i = endIdx + 1;
                        } else {
                            tokens.push(htmlString[i]);
                            i++;
                        }
                    } else {
                        tokens.push(htmlString[i]);
                        i++;
                    }
                }
                return tokens;
            }

            function typewrite(element, htmlString, speed = TYPING_SPEED, onComplete) {
                const tokens = tokenizeHTML(htmlString);
                let currentTokenIdx = 0;
                let accumulated = '';

                function typeNext() {
                    if (currentTokenIdx >= tokens.length) {
                        if (onComplete) onComplete();
                        return;
                    }

                    let token = tokens[currentTokenIdx];
                    while (token && token.startsWith('<') && token.endsWith('>')) {
                        accumulated += token;
                        currentTokenIdx++;
                        token = tokens[currentTokenIdx];
                    }

                    if (token) {
                        accumulated += token;
                        currentTokenIdx++;
                    }

                    element.innerHTML = accumulated;
                    outputContainer.scrollTop = outputContainer.scrollHeight;

                    setTimeout(typeNext, speed);
                }

                typeNext();
            }

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                windowDiv.classList.toggle('hidden');
                if (typeof window.updateWeatherObstacles === 'function') {
                    window.updateWeatherObstacles();
                }
                if (!windowDiv.classList.contains('hidden')) {
                    input.focus();
                    if (!hasTypedWelcome) {
                        hasTypedWelcome = true;
                        const welcomeHTML = `Welcome to Senthil's interactive console v1.0.0.<br>Type <span class="highlight">help</span> to see a list of commands.<br><br>`;
                        outputContainer.innerHTML = '';
                        isTyping = true;
                        typewrite(outputContainer, welcomeHTML, TYPING_SPEED, () => {
                            isTyping = false;
                            input.focus();
                        });
                    }
                }
            });

            closeBtn.addEventListener('click', () => {
                windowDiv.classList.add('hidden');
                windowDiv.classList.remove('minimized', 'maximized');
                if (typeof window.updateWeatherObstacles === 'function') {
                    window.updateWeatherObstacles();
                }
            });

            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                windowDiv.classList.remove('maximized');
                windowDiv.classList.toggle('minimized');
                if (typeof window.updateWeatherObstacles === 'function') {
                    setTimeout(window.updateWeatherObstacles, 350);
                }
            });

            maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                windowDiv.classList.remove('minimized');
                windowDiv.classList.toggle('maximized');
                if (typeof window.updateWeatherObstacles === 'function') {
                    setTimeout(window.updateWeatherObstacles, 350);
                }
            });

            header.addEventListener('click', () => {
                if (windowDiv.classList.contains('minimized')) {
                    windowDiv.classList.remove('minimized');
                    input.focus();
                    if (typeof window.updateWeatherObstacles === 'function') {
                        setTimeout(window.updateWeatherObstacles, 350);
                    }
                }
            });

            body.addEventListener('click', () => {
                input.focus();
            });

            input.addEventListener('keydown', (e) => {
                if (isTyping) {
                    e.preventDefault();
                    return;
                }
                if (e.key === 'Enter') {
                    const cmdVal = input.value.trim();
                    if (cmdVal) {
                        commandHistory.push(cmdVal);
                        historyIndex = commandHistory.length;

                        // Display user's command
                        const userLine = document.createElement('div');
                        userLine.innerHTML = `<span class="prompt">senthil:~$</span> <span class="command-text">${cmdVal}</span>`;
                        outputContainer.appendChild(userLine);

                        // Execute and display response
                        const result = executeCommand(cmdVal);
                        if (result) {
                            const resLine = document.createElement('div');
                            outputContainer.appendChild(resLine);
                            
                            isTyping = true;
                            typewrite(resLine, result, TYPING_SPEED, () => {
                                isTyping = false;
                                input.focus();
                            });
                        }
                    } else {
                        const userLine = document.createElement('div');
                        userLine.innerHTML = `<span class="prompt">senthil:~$</span>`;
                        outputContainer.appendChild(userLine);
                    }
                    input.value = '';
                    setTimeout(() => {
                        outputContainer.scrollTop = outputContainer.scrollHeight;
                    }, 10);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (historyIndex > 0) {
                        historyIndex--;
                        input.value = commandHistory[historyIndex];
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex++;
                        input.value = commandHistory[historyIndex];
                    } else {
                        historyIndex = commandHistory.length;
                        input.value = '';
                    }
                }
            });

            function executeCommand(cmdStr) {
                const parts = cmdStr.split(' ');
                const cmd = parts[0].toLowerCase();

                switch (cmd) {
                    case 'hello':
                    case 'hi':
                    case 'hey':
                        return `Hello! How can I help you today? To see the list of available commands type <span class="highlight">help</span>`;
                    case 'help':
                        return `Available commands:<br>• <span class="highlight">about</span>          - Brief bio<br>• <span class="highlight">skills</span>         - Technical proficiencies bar chart<br>• <span class="highlight">experience</span>     - Career timeline<br>• <span class="highlight">education</span>      - Education history and courses<br>• <span class="highlight">certifications</span> - Professional certificates<br>• <span class="highlight">projects</span>       - List major project directories<br>• <span class="highlight">resume</span>         - Open CV / Resume<br>• <span class="highlight">weather</span>        - Canvas weather control (e.g. "weather rain")<br>• <span class="highlight">links</span>          - Quick links list<br>• <span class="highlight">contact</span>        - Contact and social accounts<br>• <span class="highlight">theme</span>          - Toggle dark/light mode<br>• <span class="highlight">clear</span>          - Clear terminal window<br>• <span class="highlight">help</span>           - Show this screen<br><br>💡 Try system overrides: <span class="highlight">matrix</span>, <span class="highlight">gravity</span>, <span class="highlight">sudo destroy</span>`;
                    case 'education':
                        return `<b>Education History:</b><br><br>
• <b>Master of Science in Computer Science</b><br>
  <span class="highlight">[Jan 2015 - Jan 2019]</span> | <span class="error">University of Massachusetts Boston</span> | USA<br>
  <i>Courses:</i><br>
  - Advanced Algorithms<br>
  - Algorithms in Bioinformatics<br>
  - Analysis of Algorithm<br>
  - Big Data Analytics<br>
  - Linear Algebra<br>
  - Calculus<br>
  - Software Development and Design<br>
  - Database Management<br>
  - Computing Data Structure<br>
  - Mathematical Logic<br><br>
• <b>Bachelor of Engineering in Electronics and Communication</b><br>
  <span class="highlight">[Sep 2007 - Sep 2011]</span> | <span class="error">Anna University</span> | India<br>
  <i>Courses:</i><br>
  - Signal Processing<br>
  - Microprocessor<br>
  - Satellite communication<br>
  - Control Systems Design`;
                    case 'certifications':
                        return `<b>Professional Certifications:</b><br><br>
• <span class="purple">Mathematics for Machine Learning and Data Science</span><br>
  <span class="highlight">[July 2024]</span> | DeepLearning.AI on Coursera<br>
  A comprehensive course covering fundamental mathematics toolkit of machine learning: calculus, linear algebra, statistics, and probability.<br><br>
• <span class="purple">Google Prompting Essentials</span><br>
  <span class="highlight">[February 2025]</span> | Google on Coursera<br>
  AI agent design, Multimodal prompting, Prompt chaining, Prompt Design, Prompt evaluation and iteration, Responsible AI.<br><br>
• <span class="purple">Supervised Machine Learning: Regression and Classification</span><br>
  <span class="highlight">[March 2025]</span> | DeepLearning.AI on Coursera | Stanford Online<br>
  Build & train supervised machine learning models in Python using popular libraries NumPy & scikit-learn for prediction & binary classification tasks, including linear regression & logistic regression.`;
                    case 'skills':
                        return `<b>Technical Skills & Proficiencies:</b><br><br>
• <span class="highlight">Languages:</span> Python, R Programming, R Shiny, SQL, JavaScript, TypeScript, HTML, CSS, Shell Scripting, MATLAB<br><br>
• <span class="highlight">Full Stack Development:</span> Next.js, React, Tailwind CSS, Framer Motion, Zustand, Node.js, REST APIs, Streamlit, FastAPI<br><br>
• <span class="highlight">Machine Learning & AI:</span> Machine Learning, Deep Learning, LLMs & RAG, AI Agents, Computer Vision, NLP, PyTorch, Scikit-learn, XGBoost, OpenAI API, Prompt Engineering, Random Forest, SVM, Gradient Descent, PCA, Neural Networks<br><br>
• <span class="highlight">Data Science & Analytics:</span> Data Analysis, Statistical Modeling, Hypothesis Testing, Time Series Analysis, Signal Processing, Bayesian Statistics, Pandas, NumPy, Matplotlib/Seaborn, Data Visualization, Linear/Logistic Regression, Probability Theory<br><br>
• <span class="highlight">Tools & Platforms:</span> AWS, Docker, Linux, Git/GitHub, CI/CD, GitHub Actions, VS Code, Jupyter, Netlify, PyMuPDF, Pinecone`;
                    case 'experience':
                        const pastMonths = 121; // Total months from all past roles
                        const now = new Date();
                        const currentDiffMonths = Math.max(0, (now.getFullYear() - 2026) * 12 + (now.getMonth() - 3));
                        const totalYears = ((pastMonths + currentDiffMonths) / 12).toFixed(1);
                        
                        const currentYrs = Math.floor(currentDiffMonths / 12);
                        const currentMos = currentDiffMonths % 12;
                        let currentDur = "";
                        if (currentYrs > 0) currentDur += `${currentYrs} yr${currentYrs > 1 ? 's' : ''} `;
                        if (currentMos > 0 || currentYrs === 0) currentDur += `${currentMos} mo${currentMos !== 1 ? 's' : ''}`;

                        return `Work Experience Timeline:<br>
• <span class="highlight">[Apr 2026 - Present]</span> Senior Innovation Engineer, Tarento Group (Bengaluru, India) - <span class="success">(${currentDur})</span><br>
• <span class="highlight">[Jul 2025 - Apr 2026]</span> Member of Technical Staff, Amudham Naturals (Chennai, India) - <span class="success">(10 mos)</span><br>
• <span class="highlight">[Sep 2022 - Dec 2024]</span> Bioinformatician I, Brigham & Women's Hospital (Boston, USA) - <span class="success">(2 yrs 4 mos)</span><br>
• <span class="highlight">[Sep 2021 - Jul 2022]</span> Research Associate - Research Math, Nationwide Children's Hospital (Columbus, USA) - <span class="success">(11 mos)</span><br>
• <span class="highlight">[Apr 2020 - Aug 2021]</span> Research Data Analyst I, Boston University (Boston, USA) - <span class="success">(1 yr 5 mos)</span><br>
• <span class="highlight">[Jan 2019 - Mar 2020]</span> Clinical Research Coordinator II, Mass General Hospital (Boston, USA) - <span class="success">(1 yr 3 mos)</span><br>
• <span class="highlight">[Jul 2016 - Aug 2017]</span> Research Assistant, University of Massachusetts Boston (Boston, USA) - <span class="success">(1 yr 2 mos)</span><br>
• <span class="highlight">[Sep 2015 - May 2016]</span> IT Assistant, University of Massachusetts Boston (Boston, USA) - <span class="success">(9 mos)</span><br>
• <span class="highlight">[Oct 2012 - Feb 2014]</span> IT Specialist, MphasiS (Pune, India) - <span class="success">(1 yr 5 mos)</span><br><br>
Total Work Experience: <span class="success">${totalYears}+ Years (Net Active Experience)</span>`;
                    case 'projects':
                        return `List of Projects (Type <span class="highlight">project [1-3]</span> for details):<br>
  1. <span class="highlight">AI Agentic Coder</span> - Autonomous refactoring agent framework<br>
  2. <span class="highlight">Sales Predictor</span>   - Time-series analytics model<br>
  3. <span class="highlight">ThreeJS Gears</span>    - WebGL geometric animation engine`;
                    case 'project':
                        const num = parts[1];
                        if (num === '1') {
                            return `<b>AI Agentic Coder</b>:<br>
  - Role: Lead Developer<br>
  - Details: Developed an AI framework that refactors HTML and CSS modules synchronously.<br>
  - Tech Stack: Python, LangGraph, Ollama.<br>
  - Link: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Repository</a>`;
                        } else if (num === '2') {
                            return `<b>Sales Predictor</b>:<br>
  - Role: Data Analyst<br>
  - Details: Built XGBoost algorithms to predict monthly client sales indices.<br>
  - Tech Stack: R, XGBoost, Shiny.<br>
  - Link: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Repository</a>`;
                        } else if (num === '3') {
                            return `<b>ThreeJS Gears</b>:<br>
  - Role: Frontend Architect<br>
  - Details: Designed 3D flat-shaded mechanical gears that react to drag resizes and clicks.<br>
  - Tech Stack: JavaScript, WebGL, ThreeJS.<br>
  - Link: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Repository</a>`;
                        }
                        return `<span class="error">Usage: "project [1-3]". Try "project 1".</span>`;
                    case 'resume':
                        window.open('https://senthilcaesar.github.io/portfolio/', '_blank');
                        return `<span class="success">Opening resume in a new tab...</span>`;
                    case 'weather':
                        const modeArg = parts[1];
                        const modes = ['auto', 'none', 'rain', 'sun-rising', 'snowing', 'summer', 'windy', 'cloudy', 'fall', 'moon', 'matrix'];
                        if (!modeArg) {
                            return `Available weather modes: <span class="highlight">${modes.join(', ')}</span><br>Usage: "weather [mode]". Try "weather rain".`;
                        }
                        if (modes.includes(modeArg.toLowerCase())) {
                            if (typeof window.setWeather === 'function') {
                                const mapping = {
                                    'auto': { icon: '⏰', label: 'Auto (Time Sync)' },
                                    'none': { icon: '✨', label: 'Clear' },
                                    'rain': { icon: '🌧️', label: 'Rain' },
                                    'sun-rising': { icon: '🌅', label: 'Sun Rising' },
                                    'snowing': { icon: '❄️', label: 'Snowing' },
                                    'summer': { icon: '☀️', label: 'Summer' },
                                    'windy': { icon: '💨', label: 'Windy' },
                                    'cloudy': { icon: '☁️', label: 'Cloudy' },
                                    'fall': { icon: '🍁', label: 'Fall' },
                                    'moon': { icon: '🌙', label: 'Moon' },
                                    'matrix': { icon: '📟', label: 'Matrix' }
                                };
                                const selection = mapping[modeArg.toLowerCase()];
                                window.setWeather(modeArg.toLowerCase(), selection.icon, selection.label);
                                return `<span class="success">Atmosphere set to ${selection.label}.</span>`;
                            }
                            return `<span class="error">Weather engine is not ready.</span>`;
                        }
                        return `<span class="error">Unknown weather mode: "${modeArg}". Type "weather" to see options.</span>`;
                    case 'about':
                        return `I'm Senthil Palanivelu, a CS graduate from UMass Boston with a strong background in Data Analytics, AI Engineering, and Machine Learning. I build tools that apply AI and advanced analytics to solve real-world problems.`;
                    case 'blog':
                        return `Check out my latest thoughts, guides, and learnings:<br><a class="link" href="https://senthilcaesar.github.io/blogs/" target="_blank">senthilcaesar.github.io/blogs/</a>`;
                    case 'links':
                        return `Quick Links:<br>• <a class="link" href="https://senthilcaesar.github.io/portfolio/" target="_blank">Portfolio</a><br>• <a class="link" href="https://senthilcaesar.github.io/my-reading/" target="_blank">Readings</a><br>• <a class="link" href="https://senthilcaesar.github.io/knowledgelab/" target="_blank">KnowledgeLab</a><br>• <a class="link" href="https://senthilcaesar.github.io/resources/" target="_blank">URL Library</a><br>• <a class="link" href="https://senthilcaesar.github.io/contents/" target="_blank">PodTube</a><br>• <a class="link" href="https://senthilcaesar.github.io/commands/" target="_blank">Commands</a><br>• <a class="link" href="https://senthilcaesar.github.io/promptshelf/" target="_blank">Prompt Shelf</a><br>• <a class="link" href="https://senthilcaesar.github.io/notebook/" target="_blank">Notebook</a><br>• <a class="link" href="https://senthilcaesar.github.io/url-content-tracker/" target="_blank">Content Tracker</a><br>• <a class="link" href="https://senthilcaesar.github.io/blogs/" target="_blank">Blogs</a><br>• <a class="link" href="https://senthilcaesar.github.io/tech-stack/" target="_blank">Tech Stack</a><br>• <a class="link" href="https://senthilcaesar.github.io/wander-list/" target="_blank">Wanderlist</a>`;
                    case 'contact':
                        return `Let's connect!<br>• Email: <span class="highlight">senthilcaesar@gmail.com</span><br>• LinkedIn: <a class="link" href="https://www.linkedin.com/in/senthil-palanivelu-0ba38844/" target="_blank">LinkedIn Profile</a><br>• GitHub: <a class="link" href="https://github.com/SenthilCaesar" target="_blank">GitHub Profile</a><br>• Instagram: <a class="link" href="https://www.instagram.com/senthil_p89" target="_blank">Instagram Profile</a>`;
                    case 'theme':
                        const toggle = document.getElementById('theme-toggle');
                        if (toggle) {
                            toggle.click();
                            const isDark = document.body.classList.contains('dark-mode');
                            return `<span class="success">Theme toggled to ${isDark ? 'Dark Mode' : 'Light Mode'}!</span>`;
                        }
                        return `<span class="error">Theme toggle button not found.</span>`;
                    case 'clear':
                        outputContainer.innerHTML = '';
                        return '';
                    case 'matrix':
                        if (typeof window.setWeather === 'function') {
                            window.setWeather('matrix', '📟', 'Matrix');
                            return `<span class="success">Matrix simulation loaded. Wake up, Neo...</span>`;
                        }
                        return `<span class="error">Simulation engine not loaded.</span>`;
                    case 'gravity':
                        const fallSelectors = [
                            '.quick-link-card',
                            '.profile-container',
                            '.profile-name',
                            '.profile-title',
                            '.profile-affiliation',
                            '.social-links',
                            '#gear-canvas-container',
                            '.content-section',
                            '.sub-list-col',
                            '.section-divider'
                        ];
                        fallSelectors.forEach(sel => {
                            const elements = document.querySelectorAll(sel);
                            elements.forEach(el => {
                                el.classList.add('gravity-fell');
                            });
                        });
                        if (typeof window.updateWeatherObstacles === 'function') {
                            setTimeout(window.updateWeatherObstacles, 2500);
                        }
                        return `<span class="error">CRITICAL WARNING: Gravity constant has been set to 9.8m/s²... Oops! All content fell. Type <span class="highlight">antigravity</span> to restore order.</span>`;
                    case 'antigravity':
                        const restoreSelectors = [
                            '.quick-link-card',
                            '.profile-container',
                            '.profile-name',
                            '.profile-title',
                            '.profile-affiliation',
                            '.social-links',
                            '#gear-canvas-container',
                            '.content-section',
                            '.sub-list-col',
                            '.section-divider'
                        ];
                        restoreSelectors.forEach(sel => {
                            const elements = document.querySelectorAll(sel);
                            elements.forEach(el => {
                                el.classList.remove('gravity-fell');
                            });
                        });
                        if (typeof window.updateWeatherObstacles === 'function') {
                            setTimeout(window.updateWeatherObstacles, 2500);
                        }
                        return `<span class="success">Gravity restored. Elements floated back to standard orbit.</span>`;
                    case 'sudo':
                        if (parts[1] && parts[1].toLowerCase() === 'destroy') {
                            document.body.classList.add('screen-shake');
                            
                            setTimeout(() => {
                                windowDiv.classList.add('hidden');
                            }, 500);

                            setTimeout(() => {
                                document.body.classList.remove('screen-shake');
                                const glitchScreen = document.getElementById('glitch-screen');
                                if (glitchScreen) {
                                    glitchScreen.classList.add('active');
                                }
                            }, 2000);

                            return `<span class="error">CRITICAL ERROR: SYSTEM DESTRUCTION INITIATED...</span>`;
                        }
                        return `<span class="error">Usage: sudo [command]. Try "sudo destroy" if you dare.</span>`;
                    default:
                        // Check Q&A Database before falling back to error
                        const cleanedQuery = cmdStr.toLowerCase().replace(/[?.,!]/g, "").trim();
                        for (const qa of qaDatabase) {
                            for (const kw of qa.keywords) {
                                if (cleanedQuery.includes(kw)) {
                                    return qa.answer;
                                }
                            }
                        }
                        return `<span class="error">Command not found. Type "help" to list available commands.</span>`;
                }
            }

            // Resize Handler
            const resizeHandle = windowDiv.querySelector('.terminal-resize-handle');

            resizeHandle.addEventListener('mousedown', initResize, false);
            resizeHandle.addEventListener('touchstart', initResizeTouch, false);

            function initResize(e) {
                e.preventDefault();
                window.addEventListener('mousemove', startResizing, false);
                window.addEventListener('mouseup', stopResizing, false);
            }

            function startResizing(e) {
                const newWidth = (window.innerWidth - 20) - e.clientX;
                const newHeight = e.clientY - 75;

                if (newWidth > 260 && newWidth < window.innerWidth * 0.95) {
                    windowDiv.style.width = newWidth + 'px';
                }
                if (newHeight > 180 && newHeight < window.innerHeight * 0.85) {
                    windowDiv.style.height = newHeight + 'px';
                }
                if (typeof window.updateWeatherObstacles === 'function') {
                    window.updateWeatherObstacles();
                }
            }

            function stopResizing(e) {
                window.removeEventListener('mousemove', startResizing, false);
                window.removeEventListener('mouseup', stopResizing, false);
                if (typeof window.updateWeatherObstacles === 'function') {
                    window.updateWeatherObstacles();
                }
            }

            function initResizeTouch(e) {
                e.preventDefault();
                window.addEventListener('touchmove', startResizingTouch, false);
                window.addEventListener('touchend', stopResizingTouch, false);
            }

            function startResizingTouch(e) {
                const touch = e.touches[0];
                const newWidth = (window.innerWidth - 20) - touch.clientX;
                const newHeight = touch.clientY - 75;

                if (newWidth > 260 && newWidth < window.innerWidth * 0.95) {
                    windowDiv.style.width = newWidth + 'px';
                }
                if (newHeight > 180 && newHeight < window.innerHeight * 0.85) {
                    windowDiv.style.height = newHeight + 'px';
                }
                if (typeof window.updateWeatherObstacles === 'function') {
                    window.updateWeatherObstacles();
                }
            }

            function stopResizingTouch(e) {
                window.removeEventListener('touchmove', startResizingTouch, false);
                window.removeEventListener('touchend', stopResizingTouch, false);
                if (typeof window.updateWeatherObstacles === 'function') {
                    window.updateWeatherObstacles();
                }
            }

            // Glitch Reboot Event Handler
            const rebootBtn = document.getElementById('glitch-reboot-btn');
            if (rebootBtn) {
                rebootBtn.addEventListener('click', () => {
                    const glitchScreen = document.getElementById('glitch-screen');
                    if (glitchScreen) {
                        glitchScreen.classList.remove('active');
                    }
                    
                    // Restore gravity
                    const elements = document.querySelectorAll('.gravity-fell');
                    elements.forEach(el => el.classList.remove('gravity-fell'));

                    // Restore terminal window
                    windowDiv.classList.remove('hidden');
                    
                    // Reset weather back to auto
                    if (typeof window.setWeather === 'function') {
                        window.setWeather('auto', '⏰', 'Auto (Time Sync)');
                    }
                    
                    // Print reboot message in terminal
                    outputContainer.innerHTML = 'System rebooted successfully.<br>Core kernel initialized.<br><br>';
                    input.value = '';
                    input.focus();
                });
            }
        })();
