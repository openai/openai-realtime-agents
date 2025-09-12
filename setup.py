from setuptools import setup, find_packages

setup(
    name='django-agente-farsi',
    version='0.1.0',
    packages=find_packages(where='project_farsi'),
    package_dir={'': 'project_farsi'},
    include_package_data=True,
    license='MIT License',
    description='یک اپلیکیشن جنگوی قابل استفاده مجدد برای ساخت ایجنت‌های هوش مصنوعی صوتی و متنی.',
    long_description=open('README.md', encoding='utf-8').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/your-repo/agente-farsi', # Placeholder URL
    author='Jules',
    author_email='jules@example.com', # Placeholder email
    classifiers=[
        'Environment :: Web Environment',
        'Framework :: Django',
        'Framework :: Django :: 5.0',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.12',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
    ],
    install_requires=[
        'Django>=5.0',
        'requests>=2.0',
    ],
)
