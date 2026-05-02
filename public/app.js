document.addEventListener('DOMContentLoaded', () => {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.view}-view`).classList.add('active');
        });
    });

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('resume-upload');
    const analyzeBtn = document.getElementById('analyze-btn');
    let selectedFile = null;

    dropzone.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });

    function handleFile(file) {
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            dropzone.querySelector('p').innerHTML = `Selected: <span>${file.name}</span>`;
            analyzeBtn.disabled = false;
        } else {
            alert('Please select a valid PDF file.');
        }
    }

    document.getElementById('analyze-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        const loader = document.getElementById('analyze-loader');
        const results = document.getElementById('analyze-results');
        const analyzeBtn = document.getElementById('analyze-btn');

        loader.classList.remove('hidden');
        results.classList.add('hidden');
        analyzeBtn.disabled = true;

        const formData = new FormData();
        formData.append('resume', selectedFile);

        try {
            const res = await fetch('/api/analyze-resume', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server Error');

            document.getElementById('res-score').textContent = `${data.technical_maturity_score}/10`;
            document.getElementById('res-trajectory').textContent = data.trajectory;
            
            const rolesContainer = document.getElementById('res-roles');
            rolesContainer.innerHTML = '';
            data.potential_roles.forEach(role => {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = role;
                rolesContainer.appendChild(tag);
            });

            document.getElementById('sanitized-profile').value = data.sanitized_profile;

            results.classList.remove('hidden');
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            loader.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    document.getElementById('match-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sanitizedProfile = document.getElementById('sanitized-profile').value.trim();
        const jobDesc = document.getElementById('job-desc').value.trim();

        if (!sanitizedProfile || !jobDesc) {
            alert('Please provide both the sanitized profile and job description.');
            return;
        }

        const loader = document.getElementById('match-loader');
        const results = document.getElementById('match-results');
        const matchBtn = document.getElementById('match-btn');

        loader.classList.remove('hidden');
        results.classList.add('hidden');
        matchBtn.disabled = true;

        try {
            const res = await fetch('/api/match-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sanitized_profile: sanitizedProfile,
                    job_description: jobDesc
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server Error');

            animateValue(document.getElementById('match-score'), 0, data.match_score, 1000);
            
            const list = document.getElementById('career-bridge-list');
            list.innerHTML = '';
            data.career_bridge.forEach(step => {
                const li = document.createElement('li');
                li.textContent = step;
                list.appendChild(li);
            });

            document.getElementById('interview-question').textContent = data.adaptive_interview_question;

            results.classList.remove('hidden');
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            loader.classList.add('hidden');
            matchBtn.disabled = false;
        }
    });

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});
